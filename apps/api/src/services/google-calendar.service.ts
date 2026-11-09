import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { OAuth2Client } from "google-auth-library";
import { calendar, type calendar_v3 } from "googleapis/build/src/apis/calendar/index.js";

export interface GoogleMeetConsultationOptions {
  title: string;
  description?: string | null;
  scheduledStart: Date | string;
  scheduledEnd: Date | string;
  attendees?: { email: string; displayName?: string }[];
  manualMeetingUrl?: string;
}

export class ConsultationCalendarError extends Error {
  constructor(message: string, readonly pending = false) {
    super(message);
  }
}

export function googleMeetUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.origin !== "https://meet.google.com" || url.username || url.password ||
        !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(url.pathname) ||
        url.pathname === "/psf-shyj-wxf") return null;
    return url.origin + url.pathname;
  } catch {
    return null;
  }
}

function providerStatus(error: unknown) {
  const response = error as { code?: number; response?: { status?: number } } | undefined;
  return response?.response?.status ?? response?.code;
}

const requestOptions = { timeout: 3_000, retry: false };
const syncKey = "advisioConsultation";
const conferenceRequest = () => ({
  createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
});

function eventDetails(options: GoogleMeetConsultationOptions): calendar_v3.Schema$Event {
  return {
    summary: options.title,
    description: options.description || "",
    location: options.manualMeetingUrl || "Google Meet",
    start: { dateTime: new Date(options.scheduledStart).toISOString(), timeZone: "Asia/Manila" },
    end: { dateTime: new Date(options.scheduledEnd).toISOString(), timeZone: "Asia/Manila" },
    visibility: "private",
    guestsCanInviteOthers: false,
  };
}

function eventMeetUrl(event: calendar_v3.Schema$Event) {
  const status = event.conferenceData?.createRequest?.status?.statusCode;
  if (status === "pending" || status === "failure") return null;
  const video = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video");
  return googleMeetUrl(video?.uri) || googleMeetUrl(event.hangoutLink);
}

export class GoogleCalendarService {
  constructor(
    private readonly calendar = GoogleCalendarService.organizerCalendar(),
    private readonly calendarId = process.env.GOOGLE_CALENDAR_ID?.trim() || "primary",
    private readonly wait: (ms: number) => Promise<unknown> = delay,
  ) {}

  private static organizerCalendar(): calendar_v3.Calendar | null {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
    const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim();
    if (!clientId || !clientSecret || !refreshToken) return null;
    const auth = new OAuth2Client(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    return calendar({ version: "v3", auth });
  }

  private async withCalendar<T>(operation: (events: calendar_v3.Resource$Events) => Promise<T>) {
    if (!this.calendar) {
      throw new ConsultationCalendarError("Google Calendar is not configured. Ask an administrator to connect the consultation organizer, then retry.");
    }
    try {
      return await operation(this.calendar.events);
    } catch (error) {
      if (error instanceof ConsultationCalendarError) throw error;
      const status = providerStatus(error);
      if (status === 401 || status === 403) {
        throw new ConsultationCalendarError("Google Calendar denied access. Ask an administrator to check the organizer account, Calendar permissions, and Meet availability.");
      }
      throw new ConsultationCalendarError("Google Calendar could not sync this consultation. Retry, or contact an administrator if the problem persists.");
    }
  }

  private async getEvent(events: calendar_v3.Resource$Events, eventId: string) {
    try {
      const { data } = await events.get({ calendarId: this.calendarId, eventId }, requestOptions);
      if (data.status === "cancelled") return null;
      if (data.id !== eventId || data.extendedProperties?.private?.[syncKey] !== eventId) {
        throw new ConsultationCalendarError("The organizer calendar has a conflicting event. Contact an administrator.");
      }
      return data;
    } catch (error) {
      if (providerStatus(error) === 404 || providerStatus(error) === 410) return null;
      throw error;
    }
  }

  async createMeetConsultation(eventId: string, options: GoogleMeetConsultationOptions) {
    return this.withCalendar(async (events) => {
      const target = { calendarId: this.calendarId, eventId, conferenceDataVersion: 1 };
      let event = await this.getEvent(events, eventId);
      if (!event) {
        try {
          const response = await events.insert({
            calendarId: this.calendarId,
            conferenceDataVersion: 1,
            sendUpdates: "none",
            requestBody: {
              ...eventDetails(options),
              id: eventId,
              extendedProperties: { private: { [syncKey]: eventId } },
              ...(options.manualMeetingUrl ? {} : { conferenceData: conferenceRequest() }),
            },
          }, requestOptions);
          event = response.data;
        } catch (error) {
          if (providerStatus(error) !== 409) throw error;
          event = await this.getEvent(events, eventId);
          if (!event) throw error;
        }
      } else if (!options.manualMeetingUrl && event.conferenceData?.createRequest?.status?.statusCode === "failure") {
        event = (await events.patch({
          ...target,
          sendUpdates: "none",
          requestBody: { conferenceData: conferenceRequest() },
        }, requestOptions)).data;
      }

      let meetingUrl = options.manualMeetingUrl || null;
      if (meetingUrl) {
        const calendarMeetUrl = eventMeetUrl(event);
        if (calendarMeetUrl && calendarMeetUrl !== meetingUrl) {
          throw new ConsultationCalendarError("The organizer calendar already has a different Meet room. Restore the saved room or cancel and recreate the consultation.");
        }
      }
      if (!meetingUrl) {
        for (const backoff of [0, 250, 500, 1_000, 2_000]) {
          if (backoff) {
            await this.wait(backoff);
            const refreshed = await this.getEvent(events, eventId);
            if (!refreshed) throw new ConsultationCalendarError("Google Calendar removed the event before Meet was ready. Contact an administrator.");
            event = refreshed;
          }
          const status = event.conferenceData?.createRequest?.status?.statusCode;
          if (status === "failure") {
            throw new ConsultationCalendarError("Google did not generate a Meet room. Check the organizer’s Meet permissions and retry.");
          }
          meetingUrl = eventMeetUrl(event);
          if (meetingUrl) break;
        }
        if (!meetingUrl) {
          throw new ConsultationCalendarError("Google Meet is still being prepared. Retry to check the same event.", true);
        }
      }

      await this.syncEvent(events, eventId, event, options);
      return { eventId, meetingUrl };
    });
  }

  async updateConsultation(eventId: string, options: GoogleMeetConsultationOptions, savedMeetingUrl: string | null) {
    return this.withCalendar(async (events) => {
      const event = await this.getEvent(events, eventId);
      if (!event) throw new ConsultationCalendarError("The event is missing from the organizer calendar. Contact an administrator.");
      const currentMeetUrl = eventMeetUrl(event);
      if (options.manualMeetingUrl ? currentMeetUrl && currentMeetUrl !== options.manualMeetingUrl
        : !currentMeetUrl || currentMeetUrl !== googleMeetUrl(savedMeetingUrl)) {
        throw new ConsultationCalendarError("The Meet room on Google Calendar no longer matches Advisio. Restore the saved room on the organizer calendar or cancel and recreate the consultation.");
      }
      await this.syncEvent(events, eventId, event, options);
    });
  }

  private async syncEvent(
    events: calendar_v3.Resource$Events, eventId: string, event: calendar_v3.Schema$Event,
    options: GoogleMeetConsultationOptions,
  ) {
    const details = eventDetails(options);
    const existing = new Map((event.attendees || []).filter((entry) => !entry.organizer)
      .map((entry) => [entry.email?.toLowerCase(), entry]));
    const organizer = event.organizer?.email?.toLowerCase();
    const attendees = (options.attendees || []).filter((entry) => entry.email.toLowerCase() !== organizer);
    const changedAttendees = existing.size !== attendees.length || attendees.some((entry) => !existing.has(entry.email.toLowerCase()));
    if (!changedAttendees && event.visibility === details.visibility && event.guestsCanInviteOthers === details.guestsCanInviteOthers &&
        event.summary === details.summary &&
        (event.description || "") === details.description && event.location === details.location &&
        Date.parse(event.start?.dateTime || "") === Date.parse(details.start!.dateTime!) &&
        Date.parse(event.end?.dateTime || "") === Date.parse(details.end!.dateTime!)) return;
    await events.patch({
      calendarId: this.calendarId,
      eventId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        ...details,
        ...(changedAttendees ? {
          attendees: attendees.map((entry) => ({
            ...entry, responseStatus: existing.get(entry.email.toLowerCase())?.responseStatus,
          })),
        } : {}),
      },
    }, { ...requestOptions, headers: event.etag ? { "If-Match": event.etag } : {} });
  }

  async cancelConsultation(eventId: string) {
    return this.withCalendar(async (events) => {
      if (!await this.getEvent(events, eventId)) return;
      try {
        await events.delete({ calendarId: this.calendarId, eventId, sendUpdates: "all" }, requestOptions);
      } catch (error) {
        if (providerStatus(error) !== 404 && providerStatus(error) !== 410) throw error;
      }
    });
  }
}

export const googleCalendarService = new GoogleCalendarService();
