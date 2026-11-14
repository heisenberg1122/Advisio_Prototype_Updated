import type { OAuth2Client } from "google-auth-library";

type Space = { name: string; meetingUri: string };
type Member = { name: string; email: string; role: string };

export class GoogleMeetHostService {
  constructor(private readonly auth: OAuth2Client) {}

  private async request<T>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", data?: object) {
    const result = await this.auth.request<T>({
      url: `https://meet.googleapis.com/v2/${path}`,
      method,
      data,
      timeout: 3_000,
      retry: false,
    });
    return result.data;
  }

  createRoom() {
    return this.request<Space>("spaces", "POST", {
      config: { accessType: "RESTRICTED", moderation: "ON" },
    });
  }

  async completedConference(code: string, scheduledStart: Date, scheduledEnd: Date) {
    // A reused Meet link can have other conferences. Require one unambiguous
    // conference overlapping this consultation's booking.
    const filter = `space.meeting_code = "${code}" AND start_time <= "${scheduledEnd.toISOString()}" AND start_time >= "${new Date(+scheduledStart - 86_400_000).toISOString()}"`;
    const matches: Array<{ actualStart: Date; actualEnd: Date | null }> = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({ filter, pageSize: "100" });
      if (pageToken) query.set("pageToken", pageToken);
      const page = await this.request<{
        conferenceRecords?: { startTime: string; endTime?: string }[];
        nextPageToken?: string;
      }>(`conferenceRecords?${query}`, "GET");
      for (const record of page.conferenceRecords || []) {
        const actualStart = new Date(record.startTime);
        const actualEnd = record.endTime ? new Date(record.endTime) : null;
        if (Number.isFinite(+actualStart) && actualStart <= scheduledEnd &&
            (!actualEnd || (actualEnd >= scheduledStart && actualEnd > actualStart && actualEnd <= new Date()))) {
          matches.push({ actualStart, actualEnd });
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken && matches.length < 2);
    const match = matches.length === 1 ? matches[0] : undefined;
    return match?.actualEnd ? { actualStart: match.actualStart, actualEnd: match.actualEnd } : null;
  }

  async setCoHost(space: string, email: string | null) {
    const members: Member[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({ pageSize: "100" });
      if (pageToken) query.set("pageToken", pageToken);
      const page = await this.request<{ members?: Member[]; nextPageToken?: string }>(
        `${space}/members?${query}`, "GET",
      );
      members.push(...(page.members || []));
      pageToken = page.nextPageToken;
    } while (pageToken);

    const target = members.find((member) => member.email?.toLowerCase() === email?.toLowerCase());
    for (const member of members) {
      if (member.role === "COHOST" && member !== target) await this.request(member.name, "DELETE");
    }
    if (email && target?.role !== "COHOST") {
      if (target) await this.request(`${target.name}?updateMask=role`, "PATCH", { role: "COHOST" });
      else await this.request(`${space}/members`, "POST", { email, role: "COHOST" });
    }
  }
}
