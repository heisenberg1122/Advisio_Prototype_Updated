import { describe, expect, it, vi } from "vitest";
import { GoogleCalendarService, googleMeetUrl } from "./google-calendar.service.js";

const eventId = "advisio12345";
const meetingUrl = "https://meet.google.com/abc-defg-hij";
const details = {
  title: "Consultation", scheduledStart: "2034-01-01T01:00:00.000Z", scheduledEnd: "2034-01-01T02:00:00.000Z",
  attendees: [{ email: "adviser@example.test" }, { email: "student@example.test" }],
};
const pending = { createRequest: { status: { statusCode: "pending" } } };
const ready = { createRequest: { status: { statusCode: "success" } }, entryPoints: [{ entryPointType: "video", uri: meetingUrl }] };
const providerError = (status: number) => ({ response: { status, data: { authorization: "secret data" } } });

function mockCalendar() {
  const events = { get: vi.fn(), insert: vi.fn(), patch: vi.fn(), delete: vi.fn() };
  const wait = vi.fn().mockResolvedValue(undefined);
  const service = new GoogleCalendarService({ events } as unknown as NonNullable<ConstructorParameters<typeof GoogleCalendarService>[0]>, "primary", wait);
  const event = {
    id: eventId, summary: details.title, description: "", location: "Google Meet",
    visibility: "private", guestsCanInviteOthers: false,
    start: { dateTime: details.scheduledStart }, end: { dateTime: details.scheduledEnd },
    extendedProperties: { private: { advisioConsultation: eventId } },
  };
  return { events, wait, service, event };
}

describe("consultation Google Calendar integration", () => {
  it("waits for one Google Meet before inviting all attendees and reuses the event on retry", async () => {
    const { events, wait, service, event } = mockCalendar();
    events.get.mockRejectedValueOnce(providerError(404))
      .mockResolvedValueOnce({ data: { ...event, conferenceData: pending } })
      .mockResolvedValueOnce({ data: { ...event, conferenceData: ready } })
      .mockResolvedValue({ data: { ...event, conferenceData: ready, attendees: details.attendees } });
    events.insert.mockResolvedValue({ data: { ...event, conferenceData: pending } });
    await expect(service.createMeetConsultation(eventId, details)).resolves.toEqual({ eventId, meetingUrl });
    await expect(service.createMeetConsultation(eventId, details)).resolves.toEqual({ eventId, meetingUrl });
    expect(wait.mock.calls).toEqual([[250], [500]]);
    expect(events.insert).toHaveBeenCalledTimes(1);
    expect(events.insert).toHaveBeenCalledWith(expect.objectContaining({
      conferenceDataVersion: 1, sendUpdates: "none", requestBody: expect.objectContaining({
        id: eventId,
        conferenceData: { createRequest: { requestId: expect.any(String), conferenceSolutionKey: { type: "hangoutsMeet" } } },
      }),
    }), expect.anything());
    expect(events.patch).toHaveBeenCalledTimes(1);
    expect(events.patch).toHaveBeenCalledWith(expect.objectContaining({
      eventId, sendUpdates: "all", requestBody: expect.objectContaining({ attendees: details.attendees }),
    }), expect.anything());
  });

  it("bounds pending retries and never invites attendees before a link is ready", async () => {
    const { events, wait, service, event } = mockCalendar();
    events.get.mockResolvedValue({ data: { ...event, conferenceData: pending } });
    await expect(service.createMeetConsultation(eventId, details)).rejects.toMatchObject({ pending: true });
    expect(wait.mock.calls).toEqual([[250], [500], [1000], [2000]]);
    expect(events.patch).not.toHaveBeenCalled();
    expect(events.insert).not.toHaveBeenCalled();
  });

  it("recovers after a concurrent Calendar insert and checks event ownership", async () => {
    const { events, service, event } = mockCalendar();
    events.get.mockRejectedValueOnce(providerError(404))
      .mockResolvedValueOnce({ data: { ...event, conferenceData: ready, attendees: details.attendees } })
      .mockResolvedValueOnce({ data: { ...event, extendedProperties: {}, conferenceData: ready } });
    events.insert.mockRejectedValueOnce(providerError(409));
    await expect(service.createMeetConsultation(eventId, details)).resolves.toMatchObject({ meetingUrl });
    await expect(service.cancelConsultation(eventId)).rejects.toThrow("conflicting event");
    expect(events.delete).not.toHaveBeenCalled();
  });

  it("updates the same event, retains existing RSVP status, and sends cancellation updates", async () => {
    const { events, service, event } = mockCalendar();
    events.get.mockResolvedValue({ data: { ...event, conferenceData: ready, etag: "known", attendees: [
      { email: details.attendees[0].email, responseStatus: "accepted" }, details.attendees[1],
    ] } });
    await service.updateConsultation(eventId, {
      ...details, attendees: [details.attendees[0], { email: "dean@example.test" }],
      scheduledEnd: "2034-01-01T03:00:00.000Z",
    }, meetingUrl);
    expect(events.patch).toHaveBeenCalledWith(expect.objectContaining({
      eventId, sendUpdates: "all",
      requestBody: expect.objectContaining({
        attendees: [{ email: "adviser@example.test", responseStatus: "accepted" }, { email: "dean@example.test" }],
        end: { dateTime: "2034-01-01T03:00:00.000Z", timeZone: "Asia/Manila" },
      }),
    }), expect.objectContaining({ headers: { "If-Match": "known" } }));
    expect(events.insert).not.toHaveBeenCalled();
    await service.cancelConsultation(eventId);
    expect(events.delete).toHaveBeenCalledWith({ calendarId: "primary", eventId, sendUpdates: "all" }, expect.anything());
  });

  it("blocks invitation updates when the organizer changed the saved Meet room", async () => {
    const { events, service, event } = mockCalendar();
    events.get.mockResolvedValue({ data: { ...event, hangoutLink: "https://meet.google.com/uvw-xyza-bcd" } });
    await expect(service.updateConsultation(eventId, details, meetingUrl)).rejects.toThrow("no longer matches Advisio");
    expect(events.patch).not.toHaveBeenCalled();
  });

  it("restores private event visibility and prevents forwarding invites on retry", async () => {
    const { events, service, event } = mockCalendar();
    events.get.mockResolvedValue({ data: {
      ...event, conferenceData: ready, attendees: details.attendees, visibility: "public", guestsCanInviteOthers: true,
    } });
    await service.updateConsultation(eventId, details, meetingUrl);
    expect(events.patch).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({ visibility: "private", guestsCanInviteOthers: false }),
    }), expect.anything());
  });

  it("reports missing or forbidden organizer configuration without exposing provider diagnostics", async () => {
    await expect(new GoogleCalendarService(null).createMeetConsultation(eventId, details)).rejects.toThrow("not configured");
    const { events, service } = mockCalendar();
    events.get.mockRejectedValue(providerError(403));
    const error = await service.createMeetConsultation(eventId, details).catch((value) => value);
    expect(error.message).toMatch("denied access");
    expect(JSON.stringify(error)).not.toContain("secret data");
  });

  it("only accepts existing Meet room URLs, excluding the former shared room and /new", () => {
    expect(googleMeetUrl(`${meetingUrl}?authuser=0`)).toBe(meetingUrl);
    for (const unsafe of ["javascript:alert(1)", "https://meet.google.com/new", "https://meet.google.com/psf-shyj-wxf",
      "https://meet.google.com@other.test/abc-defg-hij", "https://meet.google.com.evil.test/abc-defg-hij",
      "https://user@meet.google.com/abc-defg-hij"]) {
      expect(googleMeetUrl(unsafe)).toBeNull();
    }
  });
});
