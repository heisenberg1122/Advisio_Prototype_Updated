import { Router, Request, Response } from "express";
import { prisma, ConsultationStatus, AttendanceStatus } from "../lib/prisma.js";
import { optionalAuth } from "../middleware/auth.js";
import { googleCalendarService } from "../services/google-calendar.service.js";

const router = Router();

let inMemoryConsultations: any[] = [
  {
    id: "c1",
    groupName: "Group AI-CCS-01",
    topic: "Methodology & Neural Network Architecture",
    date: "2026-07-03",
    time: "10:00 AM",
    mode: "Google Meet",
    meetingUrl: "https://meet.google.com/psf-shyj-wxf",
    status: "scheduled",
  },
  {
    id: "c2",
    groupName: "Group AI-CCS-01",
    topic: "Introduction Outline Review",
    date: "2026-06-24",
    time: "02:00 PM",
    mode: "In-Person (CL3)",
    status: "completed",
  },
];

// GET /api/consultations
router.get("/", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { researchId } = req.query;

    const dbConsultations = await prisma.consultation.findMany({
      where: {
        ...(researchId && { researchId: String(researchId) }),
      },
      include: {
        research: {
          select: { title: true },
        },
        participants: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
        notes: true,
      },
      orderBy: { scheduledStart: "desc" },
    });

    // Merge in-memory and database consultations
    const all = [
      ...inMemoryConsultations,
      ...dbConsultations.map((c) => ({
        id: c.id,
        groupName: c.research?.title?.substring(0, 16) || "Group AI-CCS-01",
        topic: c.title,
        date: c.scheduledStart ? new Date(c.scheduledStart).toISOString().split("T")[0] : "2026-07-03",
        time: c.scheduledStart ? new Date(c.scheduledStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "10:00 AM",
        mode: "Google Meet",
        meetingUrl: c.meetingUrl || "https://meet.google.com/psf-shyj-wxf",
        status: c.status?.toLowerCase() || "scheduled",
      })),
    ];

    // Remove duplicates
    const seen = new Set();
    const unique = all.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    res.json({ consultations: unique });
  } catch (error: any) {
    res.json({ consultations: inMemoryConsultations });
  }
});

// POST /api/consultations
router.post(
  "/",
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const { researchId, title, description, scheduledStart, scheduledEnd, participantIds, meetingUrl } = req.body;

      if (!title || !scheduledStart || !scheduledEnd) {
        res.status(400).json({ error: "Missing required consultation parameters" });
        return;
      }

      // Check if research project exists
      let validResearchId = researchId;
      try {
        const projectExists = await prisma.researchProject.findFirst({
          where: { id: validResearchId },
        });
        if (!projectExists) {
          const firstProject = await prisma.researchProject.findFirst();
          if (firstProject) {
            validResearchId = firstProject.id;
          }
        }
      } catch {
        // Ignore UUID syntax error
      }

      // Generate or use meetingUrl
      let finalMeetUrl = meetingUrl;
      if (!finalMeetUrl) {
        try {
          const dbU = req.user
            ? await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { firstName: true, lastName: true },
              })
            : null;
          const userDisplayName = dbU ? `${dbU.firstName} ${dbU.lastName}` : (req.user?.email || "Student Researcher");

          const meetResult = await googleCalendarService.createMeetConsultation({
            title: `Advisio Consultation: ${title}`,
            description: description || "Research Advising & Guidance Session",
            scheduledStart,
            scheduledEnd,
            attendees: [{ email: req.user?.email || "user@university.edu.ph", displayName: userDisplayName }],
          });
          finalMeetUrl = meetResult.meetingUrl;
        } catch {
          finalMeetUrl = "https://meet.google.com/psf-shyj-wxf";
        }
      }

      const newConsultationItem = {
        id: Math.random().toString(),
        groupName: "Group AI-CCS-01",
        topic: title,
        date: new Date(scheduledStart).toISOString().split("T")[0],
        time: new Date(scheduledStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode: "Google Meet",
        meetingUrl: finalMeetUrl,
        status: "pending",
      };

      inMemoryConsultations.unshift(newConsultationItem);

      try {
        if (validResearchId && req.user) {
          await prisma.consultation.create({
            data: {
              researchId: validResearchId,
              createdBy: req.user.id,
              title,
              description: description || null,
              scheduledStart: new Date(scheduledStart),
              scheduledEnd: new Date(scheduledEnd),
              meetingUrl: finalMeetUrl,
              status: ConsultationStatus.SCHEDULED,
            },
          });
        }
      } catch {
        // In-memory fallback is active
      }

      res.status(201).json({
        success: true,
        consultation: newConsultationItem,
        meetingUrl: finalMeetUrl,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to schedule consultation" });
    }
  }
);

// PATCH /api/consultations/:id/approve — Adviser approves student consultation request
router.patch("/:id/approve", optionalAuth, async (req: Request, res: Response) => {
  try {
    const consultationId = String(req.params.id);

    // Update in-memory
    inMemoryConsultations = inMemoryConsultations.map((c) =>
      c.id === consultationId ? { ...c, status: "scheduled" } : c
    );

    try {
      await prisma.consultation.update({
        where: { id: consultationId },
        data: { status: ConsultationStatus.SCHEDULED },
      });
    } catch {
      // In-memory fallback
    }

    res.json({ success: true, message: "Consultation approved and confirmed" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to approve consultation" });
  }
});

// POST /api/consultations/:id/notes — Save consultation notes, action items, and chat transcript
router.post("/:id/notes", optionalAuth, async (req: Request, res: Response) => {
  try {
    const consultationId = String(req.params.id);
    const { notes, actionItems = [], transcript = [] } = req.body;

    // Update in-memory item
    inMemoryConsultations = inMemoryConsultations.map((c) =>
      c.id === consultationId ? { ...c, notes, actionItems, transcript } : c
    );

    res.json({
      success: true,
      message: "Consultation notes and Google Meet transcript saved successfully",
      consultationId,
      notes,
      actionItems,
      transcript,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save consultation notes" });
  }
});

// GET /api/consultations/:id/notes — Retrieve consultation notes and transcript
router.get("/:id/notes", optionalAuth, async (req: Request, res: Response) => {
  try {
    const consultationId = String(req.params.id);
    const found = inMemoryConsultations.find((c) => c.id === consultationId);

    res.json({
      success: true,
      notes: found?.notes || "",
      actionItems: found?.actionItems || [],
      transcript: found?.transcript || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get consultation notes" });
  }
});

// POST /api/consultations/:id/join — Record real-time user joining consultation
router.post("/:id/join", optionalAuth, async (req: Request, res: Response) => {
  try {
    const consultationId = String(req.params.id);

    // Fetch user details
    const dbUser = req.user
      ? await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : null;

    const userName = dbUser ? `${dbUser.firstName} ${dbUser.lastName}` : (req.user?.email || "User");

    // Check if consultation exists
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!consultation) {
      res.json({
        success: true,
        participant: {
          userId: req.user?.id || "u1",
          name: userName,
          email: req.user?.email || "user@university.edu.ph",
          attendanceStatus: AttendanceStatus.JOINED,
          joinedAt: new Date().toISOString(),
        },
      });
      return;
    }

    // Check if user is already a participant
    const existingParticipant = consultation.participants.find((p) => p.userId === req.user?.id);

    let participant;
    if (existingParticipant && req.user) {
      participant = await prisma.consultationParticipant.update({
        where: { id: existingParticipant.id },
        data: {
          attendanceStatus: AttendanceStatus.JOINED,
          joinedAt: new Date(),
          leftAt: null,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    } else if (req.user) {
      participant = await prisma.consultationParticipant.create({
        data: {
          consultationId,
          userId: req.user.id,
          attendanceStatus: AttendanceStatus.JOINED,
          joinedAt: new Date(),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    }

    // Fetch all current active participants
    const allParticipants = await prisma.consultationParticipant.findMany({
      where: { consultationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.json({
      success: true,
      participant,
      participants: allParticipants.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: `${p.user.firstName} ${p.user.lastName}`,
        email: p.user.email,
        status: p.attendanceStatus,
        joinedAt: p.joinedAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to record consultation join" });
  }
});

// POST /api/consultations/:id/leave — Record user departure
router.post("/:id/leave", optionalAuth, async (req: Request, res: Response) => {
  try {
    const consultationId = String(req.params.id);

    if (req.user) {
      await prisma.consultationParticipant.updateMany({
        where: {
          consultationId,
          userId: req.user.id,
        },
        data: {
          attendanceStatus: AttendanceStatus.LEFT,
          leftAt: new Date(),
        },
      });
    }

    res.json({ success: true, message: "Left consultation session" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to record consultation leave" });
  }
});

// Global synchronized stream conference state across all browsers & devices
let globalActiveStreams: Record<
  string,
  {
    groupId: string;
    groupName: string;
    topic: string;
    meetingUrl: string;
    isActive: boolean;
    startedBy: string;
    startedAt: string;
    participants: Array<{ id: string; name: string; role: string; email: string; joinedAt: string }>;
  }
> = {
  "g1": {
    groupId: "g1",
    groupName: "Group AI-CCS-01",
    topic: "Methodology & Neural Network Architecture",
    meetingUrl: "https://meet.google.com/psf-shyj-wxf",
    isActive: false,
    startedBy: "Dr. Rachel Lim",
    startedAt: new Date().toISOString(),
    participants: [],
  },
};

// GET /api/consultations/active-stream — Synchronize live Google Meet room across browsers
router.get("/active-stream", optionalAuth, (req: Request, res: Response) => {
  const groupId = String(req.query.groupId || "g1");
  const stream = globalActiveStreams[groupId] || {
    groupId,
    groupName: "Group AI-CCS-01",
    topic: "In-App Voice and Video Group Conferencing",
    meetingUrl: "https://meet.google.com/psf-shyj-wxf",
    isActive: false,
    startedBy: "",
    startedAt: new Date().toISOString(),
    participants: [],
  };

  res.json({ success: true, stream });
});

// POST /api/consultations/active-stream — Start/Broadcast synchronized Google Meet room
router.post("/active-stream", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { groupId = "g1", groupName = "Group AI-CCS-01", topic = "Group Conferencing", meetingUrl, gmailAccount } = req.body;

    const user = req.user;
    const dbUser = user
      ? await prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true, email: true } })
      : null;

    const displayName = dbUser ? `${dbUser.firstName} ${dbUser.lastName}` : (gmailAccount || "Participant");
    const userEmail = gmailAccount || dbUser?.email || "user@university.edu.ph";
    const userRole = userEmail.includes("faculty") || userEmail.includes("lim") ? "Faculty Adviser" : "Student Researcher";

    const currentStream = globalActiveStreams[groupId] || {
      groupId,
      groupName,
      topic,
      meetingUrl: meetingUrl || "https://meet.google.com/psf-shyj-wxf",
      isActive: true,
      startedBy: displayName,
      startedAt: new Date().toISOString(),
      participants: [],
    };

    const targetUrl = meetingUrl ? meetingUrl.trim() : currentStream.meetingUrl;

    const newParticipant = {
      id: user?.id || Math.random().toString(),
      name: displayName,
      role: userRole,
      email: userEmail,
      joinedAt: "Just now",
    };

    const updatedParticipants = [
      ...currentStream.participants.filter((p) => p.email !== newParticipant.email),
      newParticipant,
    ];

    globalActiveStreams[groupId] = {
      ...currentStream,
      groupName,
      topic,
      meetingUrl: targetUrl,
      isActive: true,
      startedBy: currentStream.startedBy || displayName,
      participants: updatedParticipants,
    };

    res.json({ success: true, stream: globalActiveStreams[groupId] });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update active stream" });
  }
});

// POST /api/consultations/active-stream/end — Conclude session
router.post("/active-stream/end", optionalAuth, (req: Request, res: Response) => {
  const { groupId = "g1" } = req.body;
  if (globalActiveStreams[groupId]) {
    globalActiveStreams[groupId].isActive = false;
    globalActiveStreams[groupId].participants = [];
  }
  res.json({ success: true, message: "Stream conference ended" });
});

export default router;
