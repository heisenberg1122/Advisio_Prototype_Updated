# ADVISIO Static HTML Prototype

This folder contains an updated static HTML/CSS/JavaScript prototype of **ADVISIO: Research Management System**.

The prototype is front-end only. Dashboards, buttons, forms, paper review, writing editor, task creation, contribution tracking, chat, consultation joining, video call screens, adviser/panelist assignment modals, defense schedules, and certificate actions use mock data and JavaScript feedback only.

## How to Open

1. Extract the ZIP file.
2. Open `index.html` in Chrome, Edge, or Firefox.
3. Use the demo credentials shown on the login page.
4. The default password for every demo account is `password123`.

## Demo Accounts

- Student: `student01@university.edu.ph`
- Group Leader: `leader01@university.edu.ph`
- Adviser: `adviser01@university.edu.ph`
- Professor: `professor01@university.edu.ph`
- Dean Admin: `dean01@university.edu.ph`
- Panelist: `panelist01@university.edu.ph`
- Super Admin: `superadmin01@university.edu.ph`

## Updated Role Responsibilities

| Role | Main Purpose |
|---|---|
| Student | View only personal tasks, personal contribution, personal submissions, writing workspace, writing assistant, consultations, and defense records |
| Group Leader | View all members, assign member tasks, monitor task progress, view individual contribution, activity logs, submissions, and group writing workspace |
| Adviser | Review submitted papers with highlights, inline comments, margin comments, feedback tags, revision marks, and recommendations; no student writing editor access |
| Dean/Admin | Assign advisers and panelists through a modal, update assigned people, monitor department progress, and confirm defense schedules |
| Panelist | Access assigned papers only, add comments, ratings, and recommendations, without private student task-management visibility |
| Professor | Create research milestones, monitor class progress, manage deadlines, and run certificate automation |
| Super Admin | Manage user accounts, roles, access control, audit logs, and basic system settings |

## Major Updates Applied

- Added a separate **Group Leader** role and demo login.
- Added strict role-based visibility for student, group leader, adviser, dean/admin, and panelist views.
- Limited the regular **Student** account to personal tasks and personal contribution only.
- Added **Group Leader Task Management** with task title, description, assignees, deadline, priority, status, attachments, notes, submission status, remarks, and last updated date.
- Added a full **Student Writing Editor** with rich formatting tools, academic sections, comments, suggestion mode, track changes display, version history, word count, export buttons, save draft, and final submission actions.
- Added a built-in **Writing Assistant** panel inside the student writing workspace for grammar, rewriting, summarizing, titles, objectives, related literature structure, clarity, and organization support.
- Removed the full writing editor from the **Adviser** side and replaced it with **Paper Review Mode** only.
- Improved **Adviser Paper Review Mode** with highlights, inline comments, margin comments, feedback tags, section revision marks, general feedback, final recommendation, and return-to-student action.
- Improved **Video Consultation** with visible scheduled consultation access, Join Consultation Call button, meeting status, pre-join lobby, device check controls, large video layout, participant grid, speaker focus, chat panel, participant list, screen share, leave call, and full-screen toggle.
- Added **Dean/Admin Adviser and Panelist Assignment Modal** with research title, group name, adviser dropdown, panelist selection, multiple panelist chips, remove panelist, confirm assignment, cancel, and success message.
- Kept the original UI direction: navy/gold branding, cards, sidebar navigation, tables, modals, badges, buttons, toast messages, and responsive layout.

## Recommended Project Flow

Student writes assigned sections → Group Leader assigns and monitors member tasks → Student submits paper → Adviser reviews using highlights/comments → Student revises and resubmits → Dean/Admin assigns adviser and panelists → Student/Adviser joins consultation call → Panelist reviews assigned paper and scores → Professor/Dean finalizes completion and certificate status.

## Notes

This prototype does not include backend integration, database storage, real collaborative syncing, real file upload, real video calling, or real authentication services. It is designed for UI/UX demonstration and project defense explanation.
