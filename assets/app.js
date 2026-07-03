const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const modalRoot = document.getElementById('modal-root');

const demoAccounts = {
  'student01@university.edu.ph': 'student',
  'adviser01@university.edu.ph': 'adviser',
  'professor01@university.edu.ph': 'professor',
  'dean01@university.edu.ph': 'admin',
  'panelist01@university.edu.ph': 'panelist',
  'superadmin01@university.edu.ph': 'system-admin'
};

const defaultTabsList = [
  'Title Page', 'Abstract', 'Introduction', 'Review of Related Literature',
  'Methodology', 'Results and Discussion', 'Conclusion', 'Recommendations',
  'References', 'Appendices'
];

const state = {
  demoOpen: true,
  sidebarCollapsed: localStorage.getItem('advisio-sidebar-collapsed') === '1',
  selectedAdviser: localStorage.getItem('advisio-selected-adviser') || '',
  selectedAdviserName: localStorage.getItem('advisio-selected-adviser-name') || '',
  chosenAdviser: '',
  dynamicTasks: [],
  chatMessages: [],
  activeTab: 'Title Page',
  tabs: {
    'Title Page': `<h1>AI Crop Yield Prediction System</h1>\n<p style="text-align: center; margin-top: 50px; color: var(--text-secondary);">A Capstone Research Paper presented to the College of Computer Studies</p>\n<p style="text-align: center; margin-top: 100px;">By: Juan Reyes, Mika Santos, Ella Cruz, Noah Garcia</p>`,
    'Abstract': `<p><strong>Abstract.</strong> This study presents a research management and prediction workflow designed to help academic groups organize tasks, consultations, paper revisions, and project evaluation.</p>`,
    'Introduction': `<p>The research group needs a secure workspace where students can write sections, leaders can monitor assigned outputs, advisers can review papers, and panelists can evaluate assigned manuscripts.</p>`,
    'Review of Related Literature': `<p><span class="suggestion-mark">Suggested revision:</span> Add stronger synthesis connecting workflow systems, role-based access, and academic supervision.</p>`,
    'Methodology': `<p>The prototype will be evaluated using usability testing, adviser feedback, task completion monitoring, and document revision records.</p>`,
    'Results and Discussion': `<p>Write the results and discussion content here. You can insert tables or figures to illustrate your findings.</p>`,
    'Conclusion': `<p>Write the conclusion content here.</p>`,
    'Recommendations': `<p>Write the recommendations content here.</p>`,
    'References': `<p>Write the references content here using APA or your preferred citation style.</p>`,
    'Appendices': `<p>Write the appendices content here.</p>`
  },
  tabSavedStatus: {
    'Title Page': true, 'Abstract': true, 'Introduction': true, 'Review of Related Literature': true,
    'Methodology': true, 'Results and Discussion': true, 'Conclusion': true, 'Recommendations': true,
    'References': true, 'Appendices': true
  }
};

const icons = {
  dashboard: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h5v-6h4v6h5v-9.5"/>',
  user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  cap: '<path d="m22 10-10-5-10 5 10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  spark: '<path d="M12 2l1.8 5.4L19 9.2l-5.2 1.8L12 17l-1.8-6L5 9.2l5.2-1.8L12 2Z"/>',
  video: '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 9 4-2v10l-4-2"/>',
  upload: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
  versions: '<path d="M6 3h12v5H6z"/><path d="M6 10h12v5H6z"/><path d="M6 17h12v4H6z"/>',
  checklist: '<path d="M9 11l2 2 4-4"/><path d="M21 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9c1.3 0 2.6.3 3.7.8"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  folder: '<path d="M3 7h6l2 2h10v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 16V9"/><path d="M13 16V5"/><path d="M18 16v-4"/>',
  flag: '<path d="M5 22V4"/><path d="M5 4h13l-2 5 2 5H5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  certificate: '<circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5"/>',
  settings: '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  message: '<path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.6-1.7"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  logout: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-5"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowDown: '<path d="m6 9 6 6 6-6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3L5.8 21 7 14.2 2 9.3l6.9-1Z"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 12h20"/>',
  school: '<path d="M2 20h20"/><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
  qr: '<path d="M3 3h7v7H3Z"/><path d="M14 3h7v7h-7Z"/><path d="M3 14h7v7H3Z"/><path d="M14 14h2v2h-2Z"/><path d="M19 14h2v2h-2Z"/><path d="M14 19h2v2h-2Z"/><path d="M18 18h3v3h-3Z"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16"/><path d="M2 21h20"/><path d="M8 7h1"/><path d="M12 7h1"/><path d="M8 11h1"/><path d="M12 11h1"/><path d="M8 15h1"/><path d="M12 15h1"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
  zap: '<path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z"/>'
};

function icon(name, cls = 'ico') {
  const path = icons[name] || icons.dashboard;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const roleMeta = {
  student: { label: 'Student', initials: 'JR', name: 'Juan Reyes', email: 'student01@university.edu.ph', subtitle: 'Research Group Representative', defaultTab: 'overview' },
  adviser: { label: 'Adviser', initials: 'RL', name: 'Dr. Rachel Lim', email: 'adviser01@university.edu.ph', subtitle: 'Faculty Adviser', defaultTab: 'overview' },
  professor: { label: 'Professor', initials: 'MD', name: 'Prof. Mario Dela Cruz', email: 'professor01@university.edu.ph', subtitle: 'Research Coordinator', defaultTab: 'overview' },
  panelist: { label: 'Panelist', initials: 'LW', name: 'Dr. Lisa Wong', email: 'panelist01@university.edu.ph', subtitle: 'Defense Panel Member', defaultTab: 'overview' },
  admin: { label: 'Dean Admin', initials: 'DN', name: 'Dean Alicia Mercado', email: 'dean01@university.edu.ph', subtitle: 'College Dean / Administrator', defaultTab: 'overview' },
  'system-admin': { label: 'Super Admin', initials: 'SA', name: 'Super Admin', email: 'superadmin01@university.edu.ph', subtitle: 'User, Role, and Access Management', defaultTab: 'overview' }
};

const navGroups = {
  student: [
    { title: 'Research Work', items: [['overview', 'Dashboard', 'dashboard'], ['adviser-pool', 'Adviser', 'cap'], ['progress-tracker', 'Progress', 'chart'], ['tasks', 'Tasks', 'checklist'], ['submissions', 'Documents', 'upload'], ['contribution', 'Contribution', 'users']] },
    { title: 'Consultation', items: [['consultation-hub', 'Consultation', 'calendar'], ['chat', 'Chat', 'message'], ['video-call', 'Video Call', 'video']] },
    { title: 'Defense and Completion', items: [['defense-center', 'Defense', 'flag'], ['grades', 'Grades', 'star'], ['certificates', 'Certificates', 'certificate']] },
    { title: 'Account', items: [['notifications', 'Notifications', 'bell'], ['profile', 'Profile', 'user'], ['settings', 'Settings', 'settings']] }
  ],
  adviser: [
    { title: 'Advising', items: [['overview', 'Dashboard', 'dashboard'], ['advisees', 'Advisees', 'users'], ['risk-dashboard', 'Risk Dashboard', 'alert'], ['requests', 'Advising Requests', 'mail']] },
    { title: 'Review Workflow', items: [['tasks', 'Tasks', 'checklist'], ['submissions', 'Submitted Papers', 'file'], ['paper-review', 'Paper Review', 'edit'], ['contribution', 'Contribution', 'users']] },
    { title: 'Consultation', items: [['schedule', 'Schedule', 'calendar'], ['chat', 'Chat', 'message'], ['video-call', 'Video Call', 'video'], ['consultation-form', 'Notes', 'clipboard']] },
    { title: 'Account', items: [['notifications', 'Notifications', 'bell'], ['profile', 'Profile', 'user']] }
  ],
  professor: [
    { title: 'Class Management', items: [['overview', 'Dashboard', 'dashboard'], ['class-overview', 'Class Overview', 'school'], ['class-progress', 'Class Progress', 'chart']] },
    { title: 'Milestones', items: [['create-task', 'Create Milestone', 'plus'], ['locks', 'Deadlines and Locks', 'lock'], ['calendar', 'Calendar', 'calendar']] },
    { title: 'Completion', items: [['certificates', 'Certificate Automation', 'certificate'], ['notifications', 'Notifications', 'bell'], ['profile', 'Profile', 'user']] }
  ],
  panelist: [
    { title: 'Defense', items: [['overview', 'Dashboard', 'dashboard'], ['defense-schedule', 'Defense Schedule', 'calendar'], ['assigned-projects', 'Assigned Projects', 'folder']] },
    { title: 'Evaluation', items: [['evaluation', 'Evaluation', 'clipboard'], ['scoring-panel', 'Scoring', 'star'], ['history', 'History', 'logs']] },
    { title: 'Account', items: [['notifications', 'Notifications', 'bell'], ['profile', 'Profile', 'user']] }
  ],
  admin: [
    { title: 'Department', items: [['overview', 'Dashboard', 'dashboard'], ['department-overview', 'Department Overview', 'building'], ['progress-analytics', 'Progress Analytics', 'chart'], ['alerts', 'Alerts', 'alert']] },
    { title: 'Assignments', items: [['faculty', 'Faculty Assignments', 'users'], ['assign-advisers', 'Assign Advisers', 'cap'], ['assign-panelists', 'Assign Panelists', 'shield'], ['defense-schedule', 'Defense Schedule', 'flag']] },
    { title: 'Records', items: [['reports', 'Reports', 'file'], ['deadlines', 'Department Deadlines', 'clock'], ['profile', 'Profile', 'user']] }
  ],
  'system-admin': [
    { title: 'Platform Access', items: [['overview', 'Dashboard', 'dashboard'], ['user-management', 'User Management', 'users'], ['roles', 'Role Management', 'shield'], ['access-control', 'Access Control', 'lock']] },
    { title: 'Records', items: [['audit-log', 'Audit Log', 'logs'], ['settings', 'Settings', 'settings'], ['profile', 'Profile', 'user']] }
  ]
};

const titleMap = Object.fromEntries(Object.entries(navGroups).flatMap(([role, groups]) => groups.flatMap(group => group.items.map(item => [`${role}:${item[0]}`, item[1]]))));

const data = {
  advisers: [
    { id: 'adv-1', name: 'Dr. Rachel Lim', email: 'rachel.lim@university.edu.ph', expertise: 'Artificial Intelligence, Web Systems, Data Analytics', load: '6 of 8 groups', status: 'Available', score: 94, works: 18, department: 'College of Computer Studies', note: 'Best match for AI-supported capstone topics and prototype-heavy software research.' },
    { id: 'adv-2', name: 'Dr. Rafael Cruz', email: 'rafael.cruz@university.edu.ph', expertise: 'Mobile Development, Software Engineering, UX Research', load: '7 of 8 groups', status: 'Limited Slots', score: 88, works: 12, department: 'College of Computer Studies', note: 'Strong fit for mobile applications, workflow automation, and usability-focused projects.' },
    { id: 'adv-3', name: 'Prof. Arthur Pendleton', email: 'arthur.pendleton@university.edu.ph', expertise: 'Networks, Cybersecurity, IT Infrastructure', load: '4 of 8 groups', status: 'Available', score: 82, works: 15, department: 'College of Computer Studies', note: 'Recommended for network monitoring, information security, and infrastructure studies.' }
  ],
  student: {
    group: { name: 'Group AI-CCS-01', title: 'AI Crop Yield Prediction System', adviser: 'Dr. Rachel Lim', members: ['Juan Reyes', 'Mika Santos', 'Ella Cruz', 'Noah Garcia'], stage: 'Chapter 2', progress: 46 },
    tasks: [
      { title: 'Submit revised Chapter 1', due: '2026-07-03', assignedTo: 'Group AI-CCS-01', priority: 'High', attachment: 'Required', owner: 'Adviser', status: 'In Progress' },
      { title: 'Upload Chapter 2 review draft', due: '2026-07-08', assignedTo: 'Group AI-CCS-01', priority: 'Medium', attachment: 'Required', owner: 'Adviser', status: 'Pending' },
      { title: 'Defense readiness checklist', due: '2026-07-18', assignedTo: 'Group AI-CCS-01', priority: 'Medium', attachment: 'Not Required', owner: 'Professor', status: 'Locked' }
    ],
    contributions: [
      { name: 'Juan Reyes', role: 'Group Leader / Programmer', percent: 35, tasks: 8, status: 'On Track', remarks: 'Coordinates submissions and prototype updates.' },
      { name: 'Mika Santos', role: 'Documentation Lead', percent: 30, tasks: 7, status: 'On Track', remarks: 'Handles Chapter 1-2 revisions.' },
      { name: 'Ella Cruz', role: 'UI/UX Researcher', percent: 20, tasks: 4, status: 'Needs Follow-up', remarks: 'Submit latest usability notes.' },
      { name: 'Noah Garcia', role: 'Tester', percent: 15, tasks: 3, status: 'At Risk', remarks: 'Missed one testing task and consultation.' }
    ],
    submissions: [
      { file: 'Chapter 1 Revised Draft v3.pdf', status: 'For Review', version: 'v3', date: '2026-06-29' },
      { file: 'Chapter 2 Literature Review Draft.docx', status: 'Returned', version: 'v2', date: '2026-06-26' },
      { file: 'Proposal Matrix.xlsx', status: 'Approved', version: 'v1', date: '2026-06-18' }
    ],
    events: [
      { date: '2026-07-03', title: 'Adviser consultation', type: 'Consultation' },
      { date: '2026-07-10', title: 'Chapter 2 deadline', type: 'Deadline' },
      { date: '2026-07-24', title: 'Proposal defense review', type: 'Defense' }
    ],
    notifications: [
      { title: 'New adviser task assigned', body: 'Dr. Rachel Lim assigned Chapter 2 Review Draft.', type: 'Task', status: 'Unread' },
      { title: 'Document returned with highlights', body: 'Chapter 2 needs stronger synthesis and local sources.', type: 'Document', status: 'Unread' },
      { title: 'Consultation accepted', body: 'Your consultation request for July 3 was approved.', type: 'Consultation', status: 'Read' }
    ],
    grades: [
      { criteria: 'Research Problem and Scope', panelist: 'Dr. Lisa Wong', score: 92, remarks: 'Clear and feasible.' },
      { criteria: 'Methodology', panelist: 'Dr. Neil Santos', score: 88, remarks: 'Needs stronger validation plan.' },
      { criteria: 'Presentation', panelist: 'Prof. Mira Ramos', score: 90, remarks: 'Good delivery and prototype explanation.' }
    ]
  },
  adviser: {
    advisees: [
      { group: 'Group AI-CCS-01', title: 'AI Crop Yield Prediction System', members: 4, progress: 46, risk: 'Medium', factors: 'Pending revisions, low contribution member' },
      { group: 'Group SE-12', title: 'Mobile Attendance System with QR Verification', members: 4, progress: 38, risk: 'High', factors: 'Delayed submissions, missed consultations' },
      { group: 'Group NET-08', title: 'Campus Network Monitoring Dashboard', members: 3, progress: 68, risk: 'Low', factors: 'On track' }
    ],
    riskFactors: [
      { group: 'Group SE-12', delayed: 3, missed: 2, incomplete: 5, contribution: '62%', revisions: 4, risk: 'High' },
      { group: 'Group AI-CCS-01', delayed: 1, missed: 0, incomplete: 2, contribution: '78%', revisions: 2, risk: 'Medium' },
      { group: 'Group NET-08', delayed: 0, missed: 0, incomplete: 1, contribution: '91%', revisions: 0, risk: 'Low' }
    ],
    requests: [
      { group: 'Group IoT-04', topic: 'Smart Water Monitoring', date: '2026-06-30', status: 'Pending' },
      { group: 'Group ML-09', topic: 'Predictive Enrollment Analytics', date: '2026-06-29', status: 'Pending' }
    ],
    reviews: [
      { doc: 'Chapter 1-3 Review Draft v2', group: 'Group AI-CCS-01', due: '2026-07-01', status: 'Pending' },
      { doc: 'Methodology Matrix', group: 'Group SE-12', due: '2026-07-05', status: 'Commented' },
      { doc: 'Final Proposal v1', group: 'Group NET-08', due: '2026-07-08', status: 'Approved' }
    ],
    consultations: [
      { group: 'Group AI-CCS-01', topic: 'Research design validation', date: '2026-07-03', time: '10:00 AM', mode: 'Video Call', status: 'Accepted' },
      { group: 'Group NET-08', topic: 'Chapter 2 comments', date: '2026-07-04', time: '02:00 PM', mode: 'In Person', status: 'Pending' }
    ]
  },
  professor: {
    groups: [
      { group: 'Group AI-CCS-01', adviser: 'Dr. Rachel Lim', stage: 'Chapter 2', progress: 46, lock: 'Chapter 3 locked' },
      { group: 'Group SE-12', adviser: 'Dr. Rafael Cruz', stage: 'Prototype Testing', progress: 63, lock: 'Documentation open' },
      { group: 'Group NET-08', adviser: 'Prof. Arthur Pendleton', stage: 'Pre-defense', progress: 78, lock: 'Final revisions locked' }
    ],
    tasks: [
      { title: 'Upload Ethics Clearance', due: '2026-07-30', assignedTo: 'All Capstone Groups', priority: 'High', attachment: 'Required', status: 'Pending' },
      { title: 'Adviser Endorsement', due: '2026-08-01', assignedTo: 'Advisers', priority: 'High', attachment: 'Required', status: 'Locked' },
      { title: 'Panel Evaluation Sheet', due: '2026-08-15', assignedTo: 'Panelists', priority: 'Medium', attachment: 'Not Required', status: 'Scheduled' }
    ]
  },
  panelist: {
    defenses: [
      { group: 'Group AI-CCS-01', title: 'AI Crop Yield Prediction System', date: '2026-07-24', time: '10:00 AM', venue: 'CCS Seminar Hall', status: 'Scheduled' },
      { group: 'Group SE-12', title: 'Mobile Attendance System with QR Verification', date: '2026-07-26', time: '01:30 PM', venue: 'ICT Lab 2', status: 'Scheduled' }
    ],
    history: [
      { group: 'Group NET-08', defense: 'Proposal Defense', grade: '91.5', recommendation: 'Approved with minor revisions' },
      { group: 'Group CS-04', defense: 'Final Defense', grade: '88.0', recommendation: 'Passed' }
    ]
  },
  admin: {
    department: [
      { label: 'Total Students', value: 418, trend: 'Enrolled in research subjects' },
      { label: 'Active Groups', value: 72, trend: 'Capstone and thesis groups' },
      { label: 'Faculty Advisers', value: 24, trend: 'Available for assignment' },
      { label: 'Completed Projects', value: 128, trend: 'Archived and certificate-ready' },
      { label: 'Ongoing Defenses', value: 16, trend: 'This grading period' }
    ],
    stages: [
      { stage: 'Proposal Stage', groups: 18, percent: 24 },
      { stage: 'Chapter 1', groups: 14, percent: 38 },
      { stage: 'Chapter 2', groups: 22, percent: 46 },
      { stage: 'Chapter 3', groups: 10, percent: 60 },
      { stage: 'Pre-defense', groups: 8, percent: 78 },
      { stage: 'Final Defense', groups: 5, percent: 92 }
    ],
    alerts: [
      { title: 'Overdue submissions', count: 9, status: 'High' },
      { title: 'Missing evaluations', count: 6, status: 'Medium' },
      { title: 'Unassigned advisers', count: 4, status: 'Medium' },
      { title: 'Delayed groups', count: 11, status: 'High' }
    ]
  },
  system: {
    users: [
      { name: 'Juan Reyes', email: 'student01@university.edu.ph', role: 'Student', status: 'Active' },
      { name: 'Dr. Rachel Lim', email: 'adviser01@university.edu.ph', role: 'Adviser', status: 'Active' },
      { name: 'Prof. Mario Dela Cruz', email: 'professor01@university.edu.ph', role: 'Professor', status: 'Active' },
      { name: 'Dean Alicia Mercado', email: 'dean01@university.edu.ph', role: 'Dean Admin', status: 'Active' }
    ],
    logs: [
      { time: '2026-07-03 08:30', user: 'dean01', action: 'Confirmed defense schedule', module: 'Defense Scheduling', level: 'Info' },
      { time: '2026-07-03 09:14', user: 'panelist01', action: 'Submitted scoring sheet', module: 'Panel Evaluation', level: 'Success' },
      { time: '2026-07-03 09:45', user: 'adviser01', action: 'Requested revision with highlights', module: 'Paper Review', level: 'Info' },
      { time: '2026-07-03 10:05', user: 'student01', action: 'Submitted contribution report', module: 'Student Contribution', level: 'Info' }
    ]
  }
};

state.chatMessages = [
  { from: 'adviser', name: 'Dr. Rachel Lim', text: 'Please revise the synthesis part of Chapter 2 and connect it to your consultation workflow.', time: '9:10 AM' },
  { from: 'student', name: 'Juan Reyes', text: 'Noted, Ma’am. We will upload the revised version before Friday.', time: '9:14 AM' },
  { from: 'adviser', name: 'Dr. Rachel Lim', text: 'Good. Also ask Noah to update the testing evidence before our video consultation.', time: '9:16 AM' }
];

function cap(str) { return String(str || '').replace(/-/g, ' ').replace(/\b\w/g, s => s.toUpperCase()); }
function initials(name) { return String(name || '').split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase(); }
function esc(str) { return String(str ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
function routeTo(hash) { window.location.hash = hash; }
function showToast(message) { toastEl.textContent = message; toastEl.classList.add('show'); clearTimeout(showToast._t); showToast._t = setTimeout(() => toastEl.classList.remove('show'), 3000); }
function closeModal() { modalRoot.innerHTML = ''; }
function modal(title, body, actions = '') { modalRoot.innerHTML = `<div class="modal-backdrop" onclick="if(event.target.classList.contains('modal-backdrop')) closeModal()"><section class="modal animate-in" role="dialog" aria-modal="true"><div class="modal-head"><div><h3>${title}</h3><p>ADVISIO Research Portal</p></div><button class="close-btn" onclick="closeModal()">${icon('close')}</button></div>${body}<div class="modal-actions">${actions || `<button class="btn" onclick="closeModal()">Close</button>`}</div></section></div>`; }
function statusClass(status = '') { const s = String(status).toLowerCase(); if (['approved','active','available','success','accepted','passed','verified','complete','read','low','on track'].some(x => s.includes(x))) return 'tag-success'; if (['pending','in progress','scheduled','monitoring','draft','for review','for confirmation','limited','locked','medium','needs'].some(x => s.includes(x))) return 'tag-warn'; if (['suspended','danger','overdue','returned','high','busy','delayed','reject','risk'].some(x => s.includes(x))) return 'tag-danger'; return 'tag-info'; }
function tag(status) { return `<span class="tag ${statusClass(status)}">${esc(status)}</span>`; }
function pct(n) { return `<div class="progress-track"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, Number(n) || 0))}%"></div></div>`; }
function table(headers, rows) { return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function stat(label, value, sub, iconName = 'chart', tone = '') { return `<div class="card stat-card"><div class="stat-top"><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-sub">${sub}</div></div><span class="icon-box ${tone}">${icon(iconName)}</span></div></div>`; }
function hero(title, desc, pills = [], actions = '') { return `<section class="hero-panel animate-in"><div class="hero-inner"><div><h2>${title}</h2><p>${desc}</p>${pills.length ? `<div class="pill-row">${pills.map(p => `<span class="pill">${icon(p[1] || 'dashboard')}<span>${p[0]}</span></span>`).join('')}</div>` : ''}</div>${actions ? `<div class="hero-actions">${actions}</div>` : ''}</div></section>`; }
function feature(title, desc, iconName = 'file', tone = '') { return `<div class="feature-card"><span class="icon-box ${tone}">${icon(iconName)}</span><div><h3>${title}</h3><p>${desc}</p></div></div>`; }
function fakeSubmit(event, message) { event.preventDefault(); showToast(message); }

window.closeModal = closeModal;
window.showToast = showToast;
window.routeTo = routeTo;
window.fakeSubmit = fakeSubmit;

function renderAuthPage(type = 'login') {
  if (type === 'register') return renderPublicCard('Account Activation', 'Enter your university activation code to activate your Advisio access.', accountActivationForm());
  if (type === 'forgot') return renderPublicCard('Forgot Password', 'Request a secure password reset link from the university authentication service.', forgotForm());
  if (type === 'first-login') return renderPublicCard('First Login Setup', 'Complete your first sign-in security setup before accessing your role dashboard.', firstLoginForm());
  renderLogin();
}

function renderLogin() {
  app.innerHTML = `<section class="auth-shell"><aside class="auth-hero"><div class="auth-brand"><div class="brand-mark">A</div><div><div class="brand-title">ADVISIO</div><div class="brand-sub">Research Portal</div></div></div><div class="hero-copy animate-in"><h1>Research Advising and Document Review Management</h1><div class="hero-line"></div><p>Streamlining the academic research journey from adviser matching to tasks, contribution tracking, document review, consultation, defense, grading, and certificate automation.</p><div class="workflow-card"><div class="workflow-title"><span>Core Workflow</span><span>Updated Prototype</span></div>${['Student selects adviser','Adviser reviews and comments','Professor monitors milestones','Dean/Admin schedules defense','Panelist evaluates and scores'].map((x,i)=>`<div class="workflow-step"><div class="workflow-no">${i+1}</div><div><strong>${x}</strong><span>${i===0?'Adviser gate and matching remain active.':i===1?'Includes preview, highlights, comments, and revision requests.':i===2?'Milestones, deadlines, and certificate automation stay organized.':i===3?'Official adviser/panelist assignment and schedule confirmation.':'Evaluation results feed into completion records.'}</span></div></div>`).join('')}</div></div><div class="hero-footer">Version 2.0 Static HTML Prototype</div></aside><div class="auth-main"><section class="login-card animate-in"><div class="card-kicker">Secure Sign In</div><h2>Welcome to Advisio</h2><p>Sign in with demo university credentials to view each cleaned role prototype.</p><div id="login-error" class="alert hidden mt-16"></div><form class="form" onsubmit="doLogin(event)"><div class="form-row"><label for="email">University Email Address</label><input id="email" type="email" placeholder="name@university.edu.ph" autocomplete="username" /></div><div class="form-row"><div class="flex-between"><label for="password">Password</label><button type="button" class="auth-link" onclick="routeTo('#/forgot-password')">Forgot Password?</button></div><input id="password" type="password" placeholder="Enter password123" autocomplete="current-password" /></div><div class="form-help"><label class="check-label"><input type="checkbox" id="remember" />Remember my session on this device</label></div><button class="btn btn-primary btn-block" type="submit">${icon('logout')} Sign In to Dashboard</button></form><div class="auth-links">No access yet? <button class="auth-link" onclick="routeTo('#/register')">Activate Account</button></div><div class="auth-links"><button class="auth-link" onclick="routeTo('#/first-login-setup')">First login setup</button></div><div class="demo-box"><button class="demo-head" onclick="toggleDemo()"><span>Demo Credentials</span><span>${icon(state.demoOpen ? 'arrowDown' : 'arrowRight')}</span></button><div id="demo-list" class="${state.demoOpen ? '' : 'hidden'}"><p class="small mt-12">Click a role to fill credentials. Default password is <b>password123</b>.</p><div class="demo-grid">${Object.entries(demoAccounts).map(([email, role]) => `<button class="demo-btn" onclick="fillDemo('${email}')"><strong>${roleMeta[role].label}</strong>${email}</button>`).join('')}</div></div></div></section></div></section>`;
}

function renderPublicCard(title, desc, body) { app.innerHTML = `<section class="auth-shell"><aside class="auth-hero"><div class="auth-brand"><div class="brand-mark">A</div><div><div class="brand-title">ADVISIO</div><div class="brand-sub">Research Portal</div></div></div><div class="hero-copy animate-in"><h1>${title}</h1><div class="hero-line"></div><p>${desc}</p></div><div class="hero-footer">Version 2.0 Static HTML Prototype</div></aside><div class="auth-main"><section class="public-card animate-in"><div class="card-kicker">Account Access</div><h2>${title}</h2><p>${desc}</p>${body}<div class="auth-links"><button class="auth-link" onclick="routeTo('#/login')">Back to login</button></div></section></div></section>`; }
function accountActivationForm() { return `<form class="form" onsubmit="fakeSubmit(event, 'Account activation request submitted.')"><div class="form-row"><label>University Email</label><input type="email" placeholder="name@university.edu.ph" required></div><div class="form-row"><label>Activation Code</label><input placeholder="ADV-2026-XXXX" required></div><button class="btn btn-primary btn-block">${icon('shield')} Activate Account</button></form>`; }
function forgotForm() { return `<form class="form" onsubmit="fakeSubmit(event, 'Password reset link generated for prototype.')"><div class="form-row"><label>Registered Email</label><input type="email" placeholder="name@university.edu.ph" required></div><button class="btn btn-primary btn-block">${icon('mail')} Send Reset Link</button></form>`; }
function firstLoginForm() { return `<form class="form" onsubmit="fakeSubmit(event, 'First login setup saved. Return to login to continue.')"><div class="form-row"><label>Temporary Password</label><input type="password" required></div><div class="form-row-inline"><div class="form-row"><label>New Password</label><input type="password" required></div><div class="form-row"><label>Confirm Password</label><input type="password" required></div></div><div class="form-row"><label>Recovery Email</label><input type="email" required></div><button class="btn btn-primary btn-block">${icon('settings')} Save Security Setup</button></form>`; }

function fillDemo(email) { document.getElementById('email').value = email; document.getElementById('password').value = 'password123'; }
function toggleDemo() { state.demoOpen = !state.demoOpen; renderLogin(); }
function doLogin(event) { event.preventDefault(); const email = document.getElementById('email').value.trim().toLowerCase(); const pass = document.getElementById('password').value; const error = document.getElementById('login-error'); if (!demoAccounts[email] || pass !== 'password123') { error.textContent = 'Invalid demo credentials. Use one of the demo accounts.'; error.classList.remove('hidden'); return; } const role = demoAccounts[email]; if (role === 'student' && !state.selectedAdviser) routeTo('#/student-onboarding'); else routeTo(`#/app/${role}/${roleMeta[role].defaultTab}`); }
window.fillDemo = fillDemo; window.toggleDemo = toggleDemo; window.doLogin = doLogin;

function renderLayout(role, tab) {
  if (role === 'student' && !state.selectedAdviser) return renderStudentOnboarding();
  const meta = roleMeta[role]; const isCollapsed = state.sidebarCollapsed; const pageTitle = titleMap[`${role}:${tab}`] || `${meta.label} Dashboard`;
  app.innerHTML = `<div class="app-shell ${isCollapsed ? 'collapsed' : ''}"><aside class="sidebar ${isCollapsed ? 'collapsed' : ''}"><div class="sidebar-head"><div class="brand-mark">A</div><div class="brand-copy"><div class="brand-title">ADVISIO</div><div class="brand-sub">${meta.label}</div></div></div><div class="role-card"><div class="flex gap-10"><div class="avatar gold">${meta.initials}</div><div class="user-copy"><strong>${meta.name}</strong><span>${meta.subtitle}</span></div></div></div><nav class="nav-area">${navGroups[role].map(group => `<div class="nav-section"><div class="section-title">${group.title}</div>${group.items.map(item => renderNavItem(role, tab, item)).join('')}</div>`).join('')}</nav><div class="sidebar-foot"><button class="btn" onclick="toggleSidebar()">${icon('menu')}<span>${isCollapsed ? 'Expand Menu' : 'Collapse Menu'}</span></button><button class="btn" onclick="logout()">${icon('logout')}<span>Sign Out</span></button></div></aside><section class="main-area"><header class="topbar"><div class="topbar-title"><h1>${pageTitle}</h1><p>${meta.label} role workspace focused on research advising workflow.</p></div><div class="search-box">${icon('search')}<input placeholder="Search groups, documents, tasks, or alerts" onkeydown="if(event.key==='Enter') showToast('Prototype search: '+this.value)"></div><button class="btn btn-primary" onclick="openGlobalAction('${role}')">${icon('plus')} New Action</button></header><div class="content">${renderRole(role, tab)}</div></section></div>`;
}
function renderNavItem(role, activeTab, item) { const [id, label, iconName, count] = item; return `<button class="nav-item ${id === activeTab ? 'active' : ''}" onclick="routeTo('#/app/${role}/${id}')">${icon(iconName)}<span class="nav-copy">${label}</span>${count ? `<span class="badge-count">${count}</span>` : ''}</button>`; }
function toggleSidebar() { state.sidebarCollapsed = !state.sidebarCollapsed; localStorage.setItem('advisio-sidebar-collapsed', state.sidebarCollapsed ? '1' : '0'); parseHash(); }
function logout() { showToast('Signed out of the prototype.'); routeTo('#/login'); }
window.toggleSidebar = toggleSidebar; window.logout = logout;

function openGlobalAction(role) {
  const choices = { student: ['Upload document', 'Request consultation', 'Submit contribution report'], adviser: ['Create task', 'Review document', 'Open risk dashboard'], professor: ['Create milestone', 'Lock deadline', 'Generate certificates'], panelist: ['Open rubric', 'Submit score', 'View project'], admin: ['Assign adviser', 'Assign panelist', 'Generate defense schedule'], 'system-admin': ['Add user', 'Manage role', 'Open audit log'] }[role] || [];
  modal('Quick Create Action', `<div class="feature-grid">${choices.map(c => feature(c, 'Prototype action for the selected dashboard module.', 'zap', 'gold')).join('')}</div>`, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal(); showToast('Quick action recorded in prototype.')">Continue</button>`);
}
window.openGlobalAction = openGlobalAction;

function renderRole(role, tab) {
  if (role === 'student') return renderStudent(tab);
  if (role === 'adviser') return renderAdviser(tab);
  if (role === 'professor') return renderProfessor(tab);
  if (role === 'panelist') return renderPanelist(tab);
  if (role === 'admin') return renderAdmin(tab);
  if (role === 'system-admin') return renderSystemAdmin(tab);
  return renderStudent(tab);
}

function renderStudentOnboarding() {
  state.chosenAdviser = state.chosenAdviser || data.advisers[0].id;
  app.innerHTML = `<section class="onboarding-shell"><div class="onboarding-top"><div class="auth-brand"><div class="brand-mark" style="background:var(--navy);color:var(--gold)">A</div><div><div class="brand-title" style="color:var(--text-primary)">ADVISIO</div><div class="brand-sub">Adviser Selection Required</div></div></div><button class="btn" onclick="routeTo('#/login')">${icon('logout')} Back to Login</button></div><div class="onboarding-panel">${hero('Select your adviser before opening the Student Dashboard','Student access starts with adviser matching so the research workflow stays logical and role-based.', [['Smart adviser matching','spark'], ['Dashboard locked until selected','lock']], `<button class="btn btn-primary" onclick="confirmAdviserSelection()">${icon('checklist')} Confirm Adviser</button>`)}<div class="grid grid-3 mt-16">${data.advisers.map(adviserSelectionCard).join('')}</div></div></section>`;
}
function adviserSelectionCard(a) { return `<div class="card adviser-card ${state.chosenAdviser === a.id ? 'selected' : ''}" onclick="chooseAdviser('${a.id}')"><div class="flex-between"><div class="flex gap-10"><div class="avatar lg gold">${initials(a.name)}</div><div><h3 class="card-title">${a.name}</h3><p class="card-desc">${a.department}</p></div></div><div class="score-ring" style="--score:${a.score}"><span>${a.score}%</span></div></div><p class="card-desc"><strong>Expertise:</strong> ${a.expertise}</p><div class="flex wrap gap-8 mt-12">${tag(a.status)}${tag(a.load)}${tag(`${a.works} works`)}</div><p class="card-desc mt-12">${a.note}</p></div>`; }
function chooseAdviser(id) { state.chosenAdviser = id; renderStudentOnboarding(); }
function confirmAdviserSelection() { const adviser = data.advisers.find(a => a.id === state.chosenAdviser) || data.advisers[0]; state.selectedAdviser = adviser.id; state.selectedAdviserName = adviser.name; localStorage.setItem('advisio-selected-adviser', adviser.id); localStorage.setItem('advisio-selected-adviser-name', adviser.name); showToast(`${adviser.name} selected. Student dashboard unlocked.`); routeTo('#/app/student/overview'); }
function resetAdviserGate() { localStorage.removeItem('advisio-selected-adviser'); localStorage.removeItem('advisio-selected-adviser-name'); state.selectedAdviser = ''; state.selectedAdviserName = ''; routeTo('#/student-onboarding'); }
window.chooseAdviser = chooseAdviser; window.confirmAdviserSelection = confirmAdviserSelection; window.resetAdviserGate = resetAdviserGate;

function contributionModule(audience = 'student') {
  const rows = data.student.contributions.map(c => [c.name, c.role, `${c.percent}%`, c.tasks, tag(c.status), c.remarks, `<div class="flex gap-8"><button class="btn btn-sm" onclick="openContributionModal('${c.name}')">View</button><button class="btn btn-sm" onclick="showToast('Contribution updated for ${c.name}.')">Update</button></div>`]);
  return `${hero('Student Contribution Module','View and manage group member contribution, assigned roles, completed tasks, status, and remarks.', [['Contribution tracking','users'], ['Risk input','alert']], `<button class="btn btn-primary" onclick="showToast('Contribution report submitted for adviser review.')">${icon('upload')} Submit Contribution Report</button>`)}<div class="card mt-16">${table(['Member','Assigned Role','Contribution','Submitted Tasks','Status','Remarks','Actions'], rows)}</div><div class="grid grid-4 mt-16">${stat('Total Contribution','100%','Across all members','chart')}${stat('At-Risk Member','1','May affect group risk','alert','danger')}${stat('Submitted Tasks','22','Recorded outputs','checklist')}${stat('Report Status', audience === 'adviser' ? 'For Validation' : 'Draft Ready','Prototype only','file','gold')}</div>`;
}
function openContributionModal(name) { const c = data.student.contributions.find(x => x.name === name); modal('Contribution Details', `<div class="profile-card"><div class="avatar lg gold">${initials(c.name)}</div><h3>${c.name}</h3><p>${c.role}</p></div><div class="grid grid-2 mt-16">${stat('Contribution', c.percent+'%', c.status, 'chart')}${stat('Submitted Tasks', c.tasks, 'Prototype record', 'checklist')}</div><div class="card mt-16"><h3 class="card-title">Remarks</h3><p class="card-desc">${c.remarks}</p></div>`, `<button class="btn" onclick="closeModal()">Close</button><button class="btn btn-primary" onclick="closeModal(); showToast('Contribution note saved.')">Save Note</button>`); }
window.openContributionModal = openContributionModal;

function taskCreationModule(owner = 'adviser') {
  const base = owner === 'professor' ? data.professor.tasks : data.student.tasks;
  const rows = [...base, ...state.dynamicTasks].map(t => [t.title, t.assignedTo || 'Group AI-CCS-01', t.due, tag(t.priority || 'Medium'), t.attachment || 'Required', tag(t.status), `<div class="flex gap-8"><button class="btn btn-sm" onclick="openTaskDetails('${esc(t.title)}')">View Details</button><button class="btn btn-sm" onclick="showToast('Marked ${esc(t.title)} as done.')">Mark as Done</button><button class="btn btn-sm" onclick="openTaskModal('${owner}')">Edit</button></div>`]);
  return `${hero(owner === 'professor' ? 'Create Research Milestone Task' : 'Task Creation and Assignment','Create research-related tasks with title, description, assigned group/student, deadline, priority, attachment requirement, and status.', [['Task creation','plus'], ['Mock data only','file']], `<button class="btn btn-primary" onclick="openTaskModal('${owner}')">${icon('plus')} Create Task</button>`)}<div class="grid grid-2 mt-16"><div class="card"><h3 class="card-title">Create New Task</h3><form class="form" onsubmit="createTask(event,'${owner}')"><div class="form-row"><label>Task Title</label><input id="task-title" placeholder="Chapter 2 revision" required></div><div class="form-row"><label>Description</label><textarea id="task-desc" placeholder="Write adviser/professor instructions."></textarea></div><div class="form-row-inline"><div class="form-row"><label>Assigned Group/Student</label><input id="task-assignee" placeholder="Group AI-CCS-01" required></div><div class="form-row"><label>Deadline</label><input id="task-due" type="date" required></div></div><div class="form-row-inline"><div class="form-row"><label>Priority</label><select id="task-priority"><option>High</option><option>Medium</option><option>Low</option></select></div><div class="form-row"><label>Attachment Requirement</label><select id="task-attach"><option>Required</option><option>Optional</option><option>Not Required</option></select></div></div><div class="form-row"><label>Status</label><select id="task-status"><option>Pending</option><option>In Progress</option><option>Locked</option><option>Scheduled</option></select></div><button class="btn btn-primary">Create Task</button></form></div><div class="card"><h3 class="card-title">Task Rules</h3><div class="feature-grid">${feature('Edit', 'Update a prototype task record.', 'edit')}${feature('Mark as Done', 'Simulate task completion feedback.', 'checklist', 'success')}${feature('View Details', 'Open details in a modal preview.', 'eye')}</div></div></div><div class="card mt-16">${table(['Task','Assigned To','Deadline','Priority','Attachment','Status','Actions'], rows)}</div>`;
}
function createTask(event, owner) { event.preventDefault(); const title = document.getElementById('task-title').value; const assignedTo = document.getElementById('task-assignee').value; const due = document.getElementById('task-due').value; const priority = document.getElementById('task-priority').value; const attachment = document.getElementById('task-attach').value; const status = document.getElementById('task-status').value; state.dynamicTasks.push({ title, assignedTo, due, priority, attachment, status }); showToast('Task created and added to the prototype list.'); renderLayout(owner === 'professor' ? 'professor' : 'adviser', owner === 'professor' ? 'create-task' : 'tasks'); }
function openTaskModal(owner = 'adviser') { modal('Create / Edit Task', `<form class="form"><div class="form-row"><label>Task Title</label><input placeholder="Chapter revision task"></div><div class="form-row"><label>Description</label><textarea placeholder="Instructions and expected output."></textarea></div><div class="form-row-inline"><div class="form-row"><label>Assigned To</label><input placeholder="Group AI-CCS-01"></div><div class="form-row"><label>Deadline</label><input type="date"></div></div></form>`, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal(); showToast('Task saved in prototype.')">Save Task</button>`); }
function openTaskDetails(title) { modal('Task Details', `<div class="card"><h3 class="card-title">${title}</h3><p class="card-desc">This prototype task includes a deadline, priority level, attachment requirement, status, and student submission tracking.</p></div>`, `<button class="btn" onclick="closeModal()">Close</button>`); }
window.createTask = createTask; window.openTaskModal = openTaskModal; window.openTaskDetails = openTaskDetails;


function studentAssignedTasksModule() {
  const rows = data.student.tasks.map(t => [t.title, t.due, t.owner, t.priority, t.attachment, tag(t.status), `<div class="flex gap-8"><button class="btn btn-sm" onclick="openTaskDetails('${esc(t.title)}')">View Details</button><button class="btn btn-sm" onclick="showToast('Opened submission area for ${esc(t.title)}.')">Submit Output</button></div>`]);
  return `${hero('Assigned Tasks','View adviser-created and professor-created research tasks with due dates, status, and submission requirements.', [['Task dashboard','checklist'], ['Student view only','eye']])}<div class="card mt-16">${table(['Task','Due Date','Assigned By','Priority','Attachment','Status','Action'], rows)}</div>`;
}

function documentPreviewModule(role = 'student') {
  const adviserTools = role === 'adviser' ? `<div class="doc-toolbar"><button class="btn btn-sm btn-primary" onclick="highlightDoc()">${icon('edit')} Highlight</button><button class="btn btn-sm" onclick="addDocComment()">${icon('message')} Add Comment</button><button class="btn btn-sm btn-danger" onclick="showToast('Revision request sent to student.')">Request Revision</button><button class="btn btn-sm btn-success" onclick="showToast('Document approved in prototype.')">Approve Document</button><button class="btn btn-sm" onclick="showToast('Edit submission mode opened.')">Edit Submission</button></div>` : `<div class="doc-toolbar"><button class="btn btn-sm btn-primary" onclick="openUploadModal()">${icon('upload')} Upload File</button><button class="btn btn-sm" onclick="showToast('Submission preview refreshed.')">Preview</button><button class="btn btn-sm" onclick="showToast('Edit submission opened.')">Edit Submission</button></div>`;
  return `${hero(role === 'adviser' ? 'Paper Review with Highlight and Comments' : 'Documentation Submission Preview','Preview the document before final submission and support adviser highlights, comments, revision requests, approval, and edit actions.', [['Document preview','file'], ['Highlight comments','edit']], adviserTools)}<div class="document-review mt-16"><div class="document-page" id="document-page"><h3>Chapter 2: Review of Related Literature</h3><p>The study discusses digital research management systems and their effect on student progress monitoring. <span class="highlight">However, the literature synthesis needs stronger connection to adviser-student consultation workflows.</span> The methodology also requires clearer validation criteria for prototype evaluation.</p><p>ADVISIO centralizes document submission, consultation records, task tracking, and research progress visibility. The proposed workflow supports student accountability through contribution tracking and adviser monitoring through risk indicators.</p><p id="dynamic-highlight">The document preview allows students to check their uploaded file before final submission while advisers can add revision notes directly in the review panel.</p></div><aside class="comment-panel"><h3 class="card-title">Revision Notes</h3><div id="comment-list" class="list"><div class="list-item"><div><div class="item-title">Adviser Comment</div><div class="item-sub">Add recent local studies and connect this section to the ADVISIO workflow.</div></div>${tag('Open')}</div><div class="list-item"><div><div class="item-title">Highlight 01</div><div class="item-sub">Clarify how risk monitoring is calculated.</div></div>${tag('For Revision')}</div></div></aside></div><div class="card mt-16">${table(['File','Version','Date','Status'], data.student.submissions.map(x => [x.file, x.version, x.date, tag(x.status)]))}</div>`;
}
function highlightDoc() { const target = document.getElementById('dynamic-highlight'); if (target) target.classList.add('highlight'); showToast('Selected document section highlighted.'); }
function addDocComment() { const list = document.getElementById('comment-list'); if (list) list.insertAdjacentHTML('beforeend', `<div class="list-item"><div><div class="item-title">New Comment</div><div class="item-sub">Please revise this paragraph before resubmission.</div></div>${tag('New')}</div>`); showToast('Comment added to document preview.'); }
function openUploadModal() { modal('Upload Documentation', `<form class="form"><div class="form-row"><label>Document Type</label><select><option>Chapter 1</option><option>Chapter 2</option><option>Chapter 3</option><option>Defense File</option></select></div><div class="form-row"><label>Upload File</label><input type="file"></div><div class="form-row"><label>Submission Notes</label><textarea placeholder="Add notes for adviser."></textarea></div></form>`, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal(); showToast('Document preview generated before final submission.')">Preview Submission</button>`); }
window.highlightDoc = highlightDoc; window.addDocComment = addDocComment; window.openUploadModal = openUploadModal;

function chatModule(role = 'student') {
  const messages = state.chatMessages.map(m => `<div class="chat-bubble ${m.from === 'student' ? 'me' : ''}"><div class="chat-name">${m.name} · ${m.time}</div><div>${esc(m.text)}</div></div>`).join('');
  return `${hero('Student-Adviser Chat','Centralized consultation chat with conversation list, message thread, attachment button, timestamps, and send feedback.', [['Message thread','message'], ['Attachment ready','upload']])}<div class="chat-shell mt-16"><aside class="conversation-list"><h3 class="card-title">Conversations</h3>${['Group AI-CCS-01','Group SE-12','Dr. Rachel Lim'].map((x,i)=>`<button class="conversation ${i===0?'active':''}" onclick="showToast('Opened conversation: ${x}')"><strong>${x}</strong><span>${i===0?'Active research consultation':'Prototype conversation'}</span></button>`).join('')}</aside><section class="chat-panel"><div class="chat-header"><div><h3>Group AI-CCS-01 and Dr. Rachel Lim</h3><p>Research consultation chat</p></div>${tag('Online')}</div><div class="chat-thread" id="chat-thread">${messages}</div><form class="chat-input" onsubmit="sendChatMessage(event)"><button type="button" class="btn" onclick="showToast('Attachment picker opened in prototype.')">${icon('upload')}</button><input id="chat-message" placeholder="Type a message to your adviser..." required><button class="btn btn-primary">Send</button></form></section></div>`;
}
function sendChatMessage(event) { event.preventDefault(); const input = document.getElementById('chat-message'); const msg = input.value.trim(); if (!msg) return; state.chatMessages.push({ from: 'student', name: 'Juan Reyes', text: msg, time: 'Now' }); input.value = ''; const thread = document.getElementById('chat-thread'); thread.insertAdjacentHTML('beforeend', `<div class="chat-bubble me"><div class="chat-name">Juan Reyes · Now</div><div>${esc(msg)}</div></div>`); thread.scrollTop = thread.scrollHeight; showToast('Message sent in prototype.'); }
window.sendChatMessage = sendChatMessage;

function videoCallModule() {
  return `${hero('Video Consultation Prototype','Visual prototype for student-adviser meetings with main video area, participant tiles, controls, and notes panel.', [['Video consultation','video'], ['No real video backend','shield']])}<div class="video-shell mt-16"><section class="video-stage"><div class="meeting-title"><div><h3>Chapter 2 Revision Consultation</h3><p>July 3, 2026 · 10:00 AM · Group AI-CCS-01</p></div>${tag('Live Prototype')}</div><div class="main-video"><div class="avatar xl gold">RL</div><strong>Dr. Rachel Lim</strong><span>Adviser camera placeholder</span></div><div class="participant-row"><div class="participant-tile"><div class="avatar">JR</div><span>Juan Reyes</span></div><div class="participant-tile"><div class="avatar">MS</div><span>Mika Santos</span></div><div class="participant-tile"><div class="avatar">EC</div><span>Ella Cruz</span></div></div><div class="call-controls"><button class="btn" onclick="showToast('Microphone toggled.')">Mute</button><button class="btn" onclick="showToast('Camera toggled.')">Camera</button><button class="btn" onclick="showToast('Screen share started in prototype.')">Screen Share</button><button class="btn btn-danger" onclick="showToast('Video consultation ended in prototype.')">End Call</button></div></section><aside class="meeting-notes"><h3 class="card-title">Consultation Notes</h3><textarea class="textarea">Discuss Chapter 2 synthesis, revise local literature section, and upload updated testing evidence before the next deadline.</textarea><button class="btn btn-primary mt-12" onclick="showToast('Consultation notes saved.')">Save Notes</button><div class="list"><div class="list-item"><span>Next deadline</span>${tag('2026-07-10')}</div><div class="list-item"><span>Follow-up needed</span>${tag('Yes')}</div></div></aside></div>`;
}

function riskDashboard() {
  const a = data.adviser;
  return `${hero('Adviser Risk Dashboard','Monitor at-risk research groups using delayed submissions, missed consultations, incomplete tasks, low contribution, and pending revisions.', [['Low / Medium / High','alert'], ['Adviser monitoring','users']])}<div class="grid grid-4 mt-16">${stat('Total Advisees', a.advisees.length, 'Active groups', 'users')}${stat('High-Risk Groups', a.riskFactors.filter(r=>r.risk==='High').length, 'Immediate action needed', 'alert','danger')}${stat('Pending Reviews', a.reviews.filter(r=>r.status!=='Approved').length, 'Documents waiting', 'file','warning')}${stat('Upcoming Consultations', a.consultations.length, 'This week', 'calendar','gold')}</div><div class="card mt-16">${table(['Group','Delayed Submissions','Missed Consultations','Incomplete Tasks','Contribution Health','Pending Revisions','Risk'], a.riskFactors.map(r => [r.group, r.delayed, r.missed, r.incomplete, r.contribution, r.revisions, tag(r.risk)]))}</div><div class="grid grid-3 mt-16">${a.riskFactors.map(r => `<div class="card risk-card ${r.risk.toLowerCase()}"><div class="flex-between"><div><h3 class="card-title">${r.group}</h3><p class="card-desc">Risk source: ${data.adviser.advisees.find(g=>g.group===r.group)?.factors || 'Monitoring'}</p></div>${tag(r.risk)}</div><button class="btn btn-sm mt-12" onclick="showToast('Opened intervention plan for ${r.group}.')">Create Intervention</button></div>`).join('')}</div>`;
}

function renderStudent(tab) {
  const s = data.student;
  const selected = data.advisers.find(a => a.id === state.selectedAdviser) || data.advisers[0];
  const overview = `${hero('Student Dashboard','Submit documents, view tasks, chat with adviser, track progress, monitor contribution, and prepare for defense.', [['Adviser selected','cap'], ['Progress tracking','chart'], ['Documents','upload']], `<button class="btn" onclick="resetAdviserGate()">${icon('cap')} Change Adviser Gate</button><button class="btn btn-primary" onclick="routeTo('#/app/student/submissions')">${icon('upload')} Upload Document</button>`)}<div class="grid grid-4 mt-16">${stat('Research Progress', `${s.group.progress}%`, s.group.stage, 'chart')}${stat('Assigned Tasks', s.tasks.length, 'Adviser and professor tasks', 'checklist','gold')}${stat('Contribution Health','78%','One member needs follow-up','users','warning')}${stat('Unread Updates', s.notifications.filter(n => n.status === 'Unread').length, 'Requires attention', 'bell','warning')}</div><div class="module-layout"><div class="card"><h3 class="card-title">Workflow Timeline</h3><div class="timeline">${['Adviser selected','Chapter 1 approved','Chapter 2 returned with highlights','Chapter 3 locked','Defense readiness'].map((x,i)=>`<div class="timeline-item ${i<2?'done':i===2?'current':''}"><span class="timeline-dot"></span><div><div class="item-title">${x}</div><div class="item-sub">${i<2?'Completed and verified.':i===2?'Active revision cycle.':'Waiting for previous approval.'}</div></div></div>`).join('')}</div></div><div class="card"><h3 class="card-title">Selected Adviser</h3><div class="flex gap-12 mt-12"><div class="avatar lg gold">${initials(selected.name)}</div><div><div class="item-title">${selected.name}</div><div class="item-sub">${selected.expertise}</div><div class="flex wrap gap-8 mt-8">${tag(selected.status)}${tag(selected.load)}</div></div></div><div class="feature-grid">${feature('Chat', 'Message your adviser from one consultation thread.', 'message')}${feature('Video Call', 'Open the video consultation prototype.', 'video')}${feature('Certificates', 'Certificate automation is retained for completion.', 'certificate','gold')}</div></div></div>`;
  const pages = {
    overview,
    'adviser-pool': `${hero('Adviser Pool','View adviser credentials, expertise, advising load, and recommendation score before selection.', [['Smart matching','spark']], `<button class="btn" onclick="resetAdviserGate()">${icon('cap')} Reopen Selection Flow</button>`)}<div class="grid grid-3 mt-16">${data.advisers.map(a => adviserSelectionCard(a)).join('')}</div>`,
    'progress-tracker': `${hero('Research Progress Tracker','Detailed milestone tracker from proposal to certificate release.', [['Milestones','chart']])}<div class="card mt-16"><div class="stepper">${['Proposal Stage','Chapter 1','Chapter 2','Chapter 3','Pre-defense','Final Defense','Certificate Release'].map((x,i)=>`<div class="step ${i<2?'done':i===2?'current':''}"><div class="step-no">${i+1}</div><div><div class="item-title">${x}</div><div class="item-sub">${i<2?'Completed and verified.':i===2?'Returned with adviser highlights.':'Locked until previous requirement is complete.'}</div></div>${tag(i<2?'Done':i===2?'Current':'Locked')}</div>`).join('')}</div></div>`,
    tasks: studentAssignedTasksModule(),
    submissions: documentPreviewModule('student'),
    contribution: contributionModule('student'),
    'consultation-hub': `${hero('Consultation Hub','Request consultation, view accepted slots, and save consultation summaries.', [['Schedule','calendar'], ['Notes','clipboard']], `<button class="btn btn-primary" onclick="openConsultationModal()">${icon('plus')} Request Consultation</button>`)}<div class="grid grid-2 mt-16"><div class="card"><h3 class="card-title">Upcoming Consultations</h3><div class="list">${data.adviser.consultations.map(c => `<div class="list-item"><div><div class="item-title">${c.topic}</div><div class="item-sub">${c.date} at ${c.time} via ${c.mode}</div></div>${tag(c.status)}</div>`).join('')}</div></div><div class="card"><h3 class="card-title">Consultation Summary</h3><form class="form" onsubmit="fakeSubmit(event,'Consultation summary saved.')"><textarea placeholder="Write summary and next actions."></textarea><button class="btn btn-primary">Save Summary</button></form></div></div>`,
    chat: chatModule('student'),
    'video-call': videoCallModule(),
    'defense-center': `${hero('Defense Center','View defense readiness checklist, proposed schedule, and requirements.', [['Readiness checklist','checklist'], ['Defense schedule','flag']])}<div class="grid grid-2 mt-16"><div class="card"><h3 class="card-title">Defense Readiness</h3><div class="stepper">${['Adviser endorsement','Required chapters approved','Similarity check submitted','Panel assigned','Schedule confirmed'].map((x,i)=>`<div class="step ${i<2?'done':i===2?'current':''}"><div class="step-no">${i+1}</div><div><div class="item-title">${x}</div><div class="item-sub">${i<2?'Complete.':i===2?'In progress.':'Pending dean/admin action.'}</div></div>${tag(i<2?'Done':i===2?'Current':'Pending')}</div>`).join('')}</div></div><div class="card"><h3 class="card-title">Proposed Defense</h3>${table(['Type','Date','Venue','Status'], [['Proposal Defense','2026-07-24','CCS Seminar Hall', tag('For Confirmation')]])}</div></div>`,
    grades: `${hero('Grades and Remarks','View panelist scores, recommendations, and research remarks.', [['Evaluation results','star']])}<div class="card mt-16">${table(['Criteria','Panelist','Score','Remarks'], s.grades.map(g => [g.criteria, g.panelist, g.score, g.remarks]))}</div>`,
    certificates: `${hero('Certificates','Certificate automation is kept: students can preview QR-verified completion certificates after approval.', [['QR certificate','qr'], ['Completion record','certificate']], `<button class="btn btn-primary" onclick="showToast('Certificate preview opened.')">${icon('certificate')} Preview Certificate</button>`)}<div class="grid grid-2 mt-16"><div class="certificate-preview"><div class="brand-mark">A</div><h2>Certificate of Research Completion</h2><p>Presented to Group AI-CCS-01 after final approval and panel score verification.</p><div class="qr-box">QR</div></div><div class="card"><h3 class="card-title">Certificate Status</h3><div class="list"><div class="list-item"><span>Final defense result</span>${tag('Pending')}</div><div class="list-item"><span>Dean approval</span>${tag('Pending')}</div><div class="list-item"><span>QR verification</span>${tag('Ready after approval')}</div></div></div></div>`,
    notifications: `${hero('Notifications','Central feed for task, document, consultation, defense, and certificate updates.', [['Alerts','bell']])}<div class="card mt-16"><div class="list">${s.notifications.map(n => `<div class="list-item"><div><div class="item-title">${n.title}</div><div class="item-sub">${n.body}</div></div>${tag(n.status)}</div>`).join('')}</div></div>`,
    profile: profileCard(roleMeta.student),
    settings: settingsCard('student')
  };
  return pages[tab] || overview;
}

function renderAdviser(tab) {
  const a = data.adviser;
  const overview = `${hero('Adviser Dashboard','Review documents, comment/highlight, assign tasks, monitor risk, validate contribution, and consult with students.', [['Paper review','edit'], ['Risk monitoring','alert'], ['Consultation','message']], `<button class="btn btn-primary" onclick="openTaskModal('adviser')">${icon('plus')} Create Task</button>`)}<div class="grid grid-4 mt-16">${stat('Advisee Groups', a.advisees.length, 'Active workspaces', 'users')}${stat('High Risk', a.riskFactors.filter(r=>r.risk==='High').length, 'Needs immediate action', 'alert','danger')}${stat('Papers for Review', a.reviews.length, 'Chapters and letters', 'file')}${stat('Consultations', a.consultations.length, 'This week', 'calendar','gold')}</div><div class="module-layout"><div class="card"><h3 class="card-title">My Advisees</h3>${table(['Group','Project','Members','Progress','Risk'], a.advisees.map(g => [g.group, g.title, g.members, pct(g.progress), tag(g.risk)]))}</div><div class="card"><h3 class="card-title">Advisor Priorities</h3><div class="feature-grid">${feature('Review Highlighted Drafts','Use paper review for revision comments.','edit','gold')}${feature('Create Intervention','Use risk dashboard for delayed groups.','alert','danger')}${feature('Validate Contribution','Check individual member outputs.','users')}</div></div></div>`;
  const pages = {
    overview,
    advisees: `${hero('My Advisees','Assigned research groups with progress and monitoring.', [['Group management','users']])}<div class="grid grid-3 mt-16">${a.advisees.map(g => `<div class="card"><div class="flex-between"><div><h3 class="card-title">${g.group}</h3><p class="card-desc">${g.title}</p></div>${tag(g.risk)}</div><div class="mt-12">${pct(g.progress)}</div><p class="card-desc mt-12">${g.factors}</p><button class="btn btn-sm mt-12" onclick="showToast('Opened ${g.group} workspace.')">${icon('folder')} Workspace</button></div>`).join('')}</div>`,
    'risk-dashboard': riskDashboard(),
    requests: `${hero('Advising Requests','Accept or reject student/group adviser requests.', [['Applications','mail']])}<div class="card mt-16">${table(['Group','Topic','Date','Status','Action'], a.requests.map(r => [r.group, r.topic, r.date, tag(r.status), `<div class="flex gap-8"><button class="btn btn-sm btn-success" onclick="showToast('Accepted ${r.group}.')">Accept</button><button class="btn btn-sm btn-danger" onclick="showToast('Rejected ${r.group}.')">Reject</button></div>`]))}</div>`,
    tasks: taskCreationModule('adviser'),
    submissions: `${hero('Submitted Papers','Review uploaded research files and their status.', [['Review queue','file']])}<div class="card mt-16">${table(['Document','Group','Due','Status','Action'], a.reviews.map(r => [r.doc, r.group, r.due, tag(r.status), `<button class="btn btn-sm" onclick="routeTo('#/app/adviser/paper-review')">Review</button>`]))}</div>`,
    'paper-review': documentPreviewModule('adviser'),
    contribution: contributionModule('adviser'),
    schedule: `${hero('Consultation Schedule','Manage meeting slots for student research consultations.', [['Schedule','calendar']])}<div class="card mt-16">${table(['Group','Topic','Date','Time','Mode','Status'], a.consultations.map(c => [c.group, c.topic, c.date, c.time, c.mode, tag(c.status)]))}</div>`,
    chat: chatModule('adviser'),
    'video-call': videoCallModule(),
    'consultation-form': `${hero('Consultation Notes','Record consultation details, required revisions, next deadline, and follow-up status.', [['Notes','clipboard']])}<div class="grid grid-2 mt-16"><div class="card"><form class="form" onsubmit="fakeSubmit(event,'Consultation note saved.')"><div class="form-row"><label>Group</label><select><option>Group AI-CCS-01</option><option>Group SE-12</option></select></div><div class="form-row"><label>Topics Discussed</label><textarea placeholder="Research design, revisions, prototype testing"></textarea></div><div class="form-row"><label>Next Deadline</label><input type="date"></div><button class="btn btn-primary">Save Notes</button></form></div><div class="card"><h3 class="card-title">Recent Notes</h3><div class="list"><div class="list-item"><span>Chapter 2 synthesis revision</span>${tag('Follow-up Needed')}</div><div class="list-item"><span>Prototype evidence upload</span>${tag('Completed')}</div></div></div></div>`,
    notifications: `${hero('Adviser Notifications','Updates for submissions, risks, consultations, and contribution reports.', [['Alerts','bell']])}<div class="card mt-16"><div class="list"><div class="list-item"><span>Group SE-12 became high risk</span>${tag('Unread')}</div><div class="list-item"><span>New contribution report submitted</span>${tag('Unread')}</div></div></div>`,
    profile: profileCard(roleMeta.adviser)
  };
  return pages[tab] || overview;
}

function renderProfessor(tab) {
  const p = data.professor;
  const overview = `${hero('Professor Dashboard','Create research milestones, monitor class progress, manage deadlines, and keep certificate automation for completion.', [['Milestones','plus'], ['Class progress','chart'], ['Certificate automation','certificate']], `<button class="btn btn-primary" onclick="openTaskModal('professor')">${icon('plus')} Create Milestone</button>`)}<div class="grid grid-4 mt-16">${stat('Active Groups', p.groups.length, 'Monitored classes', 'users')}${stat('Milestone Tasks', p.tasks.length, 'Configured requirements', 'checklist')}${stat('Locked Items', 2, 'Rule-based progression', 'lock','warning')}${stat('Certificates Ready', 5, 'Pending automation batch', 'certificate','gold')}</div><div class="card mt-16">${table(['Group','Adviser','Stage','Progress','Lock Status'], p.groups.map(g => [g.group, g.adviser, g.stage, pct(g.progress), tag(g.lock)]))}</div>`;
  const pages = { overview,
    'class-overview': `${hero('Class Overview','Monitor student groups, advisers, stages, and completion risk.', [['Class monitoring','school']])}<div class="card mt-16">${table(['Group','Adviser','Stage','Progress','Lock'], p.groups.map(g => [g.group, g.adviser, g.stage, pct(g.progress), tag(g.lock)]))}</div>`,
    'class-progress': `${hero('Review Class Progress','Track milestones by group and identify classes needing support.', [['Progress','chart']])}<div class="grid grid-3 mt-16">${p.groups.map(g => `<div class="card"><h3 class="card-title">${g.group}</h3><p class="card-desc">${g.stage} · ${g.adviser}</p>${pct(g.progress)}<div class="mt-12">${tag(g.lock)}</div></div>`).join('')}</div>`,
    'create-task': taskCreationModule('professor'),
    locks: `${hero('Deadlines and Locks','Control milestone access and department-wide deadlines.', [['Lock stages','lock']])}<div class="grid grid-2 mt-16"><div class="card"><h3 class="card-title">Milestone Locks</h3>${table(['Milestone','Condition','Effect'], [['Chapter 3','Chapter 2 approved','Unlock upload'], ['Defense Request','Adviser endorsement approved','Notify Dean/Admin'], ['Certificate Generation','Panel scores finalized','Generate QR certificate']])}</div><div class="card"><h3 class="card-title">Set Deadline</h3><form class="form" onsubmit="fakeSubmit(event,'Deadline published to class.')"><input placeholder="Chapter 3 Final Submission"><input type="date"><button class="btn btn-primary">Publish</button></form></div></div>`,
    calendar: `${hero('General Calendar','Class-level schedule for milestones, deadlines, consultations, and defense dates.', [['Calendar','calendar']])}${calendarGrid(data.student.events)}`,
    certificates: `${hero('Certificate Automation','Retained feature: generate QR-verified completion certificates after final defense and approval.', [['Certificate batch','certificate'], ['QR verification','qr']], `<button class="btn btn-primary" onclick="showToast('Certificate batch generated in prototype.')">${icon('certificate')} Generate Certificates</button>`)}<div class="grid grid-3 mt-16">${stat('Ready for Certificate',5,'Passed and dean-approved','certificate','gold')}${stat('Pending Score Sheet',3,'Waiting for panelists','star','warning')}${stat('Generated This Term',128,'Archived projects','qr')}</div><div class="card mt-16">${table(['Group','Condition','Certificate Status','Action'], [['Group NET-08','Final score verified',tag('Ready'),'<button class="btn btn-sm btn-primary">Generate</button>'], ['Group CS-04','Dean approval complete',tag('Generated'),'<button class="btn btn-sm">Preview</button>'], ['Group AI-CCS-01','Defense pending',tag('Locked'),'<button class="btn btn-sm">View</button>']])}</div>`,
    notifications: `${hero('Professor Notifications','Class progress, milestone, and certificate updates.', [['Notifications','bell']])}<div class="card mt-16"><div class="list"><div class="list-item"><span>Chapter 2 deadline approaching</span>${tag('Unread')}</div><div class="list-item"><span>5 certificates ready for generation</span>${tag('Unread')}</div></div></div>`,
    profile: profileCard(roleMeta.professor)
  };
  return pages[tab] || overview;
}

function renderPanelist(tab) {
  const p = data.panelist;
  const overview = `${hero('Panelist Dashboard','View assigned defenses, review projects, evaluate students, submit scores, and see history.', [['Defense schedule','calendar'], ['Scoring','star']])}<div class="grid grid-3 mt-16">${stat('Assigned Defenses', p.defenses.length, 'This period', 'flag')}${stat('Pending Scores', 2, 'Awaiting submission', 'star','warning')}${stat('History Records', p.history.length, 'Past evaluations', 'logs')}</div><div class="card mt-16">${table(['Group','Project','Date','Time','Venue','Status'], p.defenses.map(d => [d.group, d.title, d.date, d.time, d.venue, tag(d.status)]))}</div>`;
  const pages = { overview,
    'defense-schedule': `${hero('Defense Schedule','View assigned defense schedules only.', [['Schedule','calendar']])}<div class="card mt-16">${table(['Group','Project','Date','Time','Venue','Status'], p.defenses.map(d => [d.group, d.title, d.date, d.time, d.venue, tag(d.status)]))}</div>`,
    'assigned-projects': `${hero('Assigned Projects','Access submitted research documents and project profiles assigned to this panelist.', [['Documents','folder']])}<div class="card mt-16">${table(['Group','Project','Document','Status'], p.defenses.map(d => [d.group, d.title, 'Full Manuscript.pdf', tag('Available')]))}</div>`,
    evaluation: `${hero('Evaluation','Provide comments and recommendations during defense.', [['Evaluation','clipboard']])}<div class="grid grid-2 mt-16"><div class="card"><h3 class="card-title">Evaluation Form</h3><form class="form" onsubmit="fakeSubmit(event,'Panel evaluation saved.')"><select><option>Group AI-CCS-01</option><option>Group SE-12</option></select><textarea placeholder="Comments and recommendations"></textarea><button class="btn btn-primary">Save Evaluation</button></form></div><div class="card"><h3 class="card-title">Recommendation Options</h3><div class="list"><div class="list-item"><span>Approved</span>${tag('Option')}</div><div class="list-item"><span>Approved with minor revisions</span>${tag('Option')}</div><div class="list-item"><span>Major revisions</span>${tag('Option')}</div></div></div></div>`,
    'scoring-panel': `${hero('Scoring Panel','Submit panel scores using a simple digital rubric.', [['Rubric','star']])}<div class="card mt-16"><div class="rubric">${['Problem and Scope','Methodology','System Prototype','Presentation'].map(c => `<div class="rubric-row"><strong>${c}</strong><input type="number" min="0" max="100" value="90"><button class="btn btn-sm" onclick="showToast('Saved ${c} score.')">Save</button></div>`).join('')}</div><button class="btn btn-primary mt-16" onclick="showToast('Scores submitted to dean/admin.')">Submit Scores</button></div>`,
    history: `${hero('Historical Records','Stored grading records, scores, and recommendations from prior defenses.', [['Archive','logs']])}<div class="card mt-16">${table(['Group','Defense','Grade','Recommendation'], p.history.map(h => [h.group, h.defense, h.grade, h.recommendation]))}</div>`,
    notifications: `${hero('Panelist Notifications','Defense reminders and score submission updates.', [['Notifications','bell']])}<div class="card mt-16"><div class="list"><div class="list-item"><span>Defense schedule posted for Group AI-CCS-01</span>${tag('Unread')}</div><div class="list-item"><span>Score sheet pending</span>${tag('Unread')}</div></div></div>`,
    profile: profileCard(roleMeta.panelist)
  };
  return pages[tab] || overview;
}

function renderAdmin(tab) {
  const a = data.admin;
  const overview = `${hero('Dean/Admin Dashboard','Assign advisers and panelists, confirm defense schedules, monitor department progress, and review reports.', [['Department overview','building'], ['Assignments','users'], ['Defense scheduling','flag']], `<button class="btn btn-primary" onclick="openDeanScheduleModal()">${icon('calendar')} Generate Defense Schedule</button>`)}<div class="grid grid-5 mt-16">${a.department.map((x,i) => stat(x.label, x.value, x.trend, i===0?'users':i===1?'briefcase':i===2?'cap':i===3?'certificate':'flag')).join('')}</div><div class="module-layout"><div class="card"><h3 class="card-title">Progress Analytics</h3>${table(['Stage','Groups','Completion'], a.stages.map(s => [s.stage, s.groups, pct(s.percent)]))}</div><div class="card"><h3 class="card-title">Alerts</h3><div class="list">${a.alerts.map(al => `<div class="list-item"><div><div class="item-title">${al.title}</div><div class="item-sub">${al.count} items need attention</div></div>${tag(al.status)}</div>`).join('')}</div></div></div>`;
  const pages = { overview,
    'department-overview': `${hero('Department Overview','High-level college and department research status.', [['Metrics','building']])}<div class="grid grid-5 mt-16">${a.department.map((x,i)=>stat(x.label,x.value,x.trend,i===0?'users':i===1?'briefcase':i===2?'cap':i===3?'certificate':'flag')).join('')}</div>`,
    'progress-analytics': `${hero('Progress Analytics','Track proposal, chapters, pre-defense, and final defense completion.', [['Analytics','chart']])}<div class="card mt-16">${table(['Stage','Groups','Completion Progress','Action'], a.stages.map(s => [s.stage, s.groups, pct(s.percent), `<button class="btn btn-sm" onclick="showToast('Filtered ${s.stage}.')">View Groups</button>`]))}</div>`,
    alerts: `${hero('Alerts','Overdue tasks, missing evaluations, unassigned advisers, and delayed groups.', [['Alert center','alert']])}<div class="grid grid-2 mt-16">${a.alerts.map(al => `<div class="card"><div class="flex-between"><div><h3 class="card-title">${al.title}</h3><p class="card-desc">${al.count} records require dean/admin review.</p></div><span class="icon-box ${al.status === 'High' ? 'danger' : 'warning'}">${icon('alert')}</span></div><div class="mt-12">${tag(al.status)}</div><button class="btn btn-sm mt-12" onclick="showToast('Opened alert: ${al.title}.')">Review</button></div>`).join('')}</div>`,
    faculty: `${hero('Faculty Assignments','View adviser and panelist loads before assignment.', [['Faculty load','users']])}<div class="grid grid-3 mt-16">${data.advisers.map(f => `<div class="card"><div class="flex gap-10"><div class="avatar lg gold">${initials(f.name)}</div><div><h3 class="card-title">${f.name}</h3><p class="card-desc">${f.expertise}</p></div></div><div class="flex wrap gap-8 mt-12">${tag(f.load)}${tag(f.status)}</div></div>`).join('')}</div>`,
    'assign-advisers': `${hero('Assign Advisers','Assign faculty advisers and resolve unassigned research groups.', [['Assignment','cap']])}<div class="card mt-16">${table(['Group','Topic','Recommended Adviser','Status','Action'], [['Group IoT-04','Smart Water Monitoring','Prof. Arthur Pendleton',tag('Unassigned'),'<button class="btn btn-sm btn-primary" onclick="showToast(\'Adviser assigned in prototype.\')">Assign</button>'], ['Group ML-09','Predictive Enrollment Analytics','Dr. Rachel Lim',tag('Unassigned'),'<button class="btn btn-sm btn-primary" onclick="showToast(\'Adviser assigned in prototype.\')">Assign</button>']])}</div>`,
    'assign-panelists': `${hero('Assign Panelists','Create defense panels using availability and specialization.', [['Panel assignment','shield']])}<div class="card mt-16">${table(['Defense','Panel 1','Panel 2','Panel 3','Status'], [['Group AI-CCS-01','Dr. Lisa Wong','Prof. Neil Santos','Prof. Mira Ramos',tag('Ready')], ['Group SE-12','Dr. Lisa Wong','Dr. Rafael Cruz','Prof. Arthur Pendleton',tag('For Review')]])}</div>`,
    'defense-schedule': `${hero('Defense Schedule','Confirm official defense schedules by group, room, panel, and date.', [['Defense management','flag']], `<button class="btn btn-primary" onclick="openDeanScheduleModal()">${icon('calendar')} Generate Schedule</button>`)}<div class="card mt-16">${table(['Group','Type','Date','Room','Panel'], [['Group AI-CCS-01','Proposal Defense','2026-07-24','CCS Seminar Hall','Wong, Santos, Ramos'], ['Group SE-12','Prototype Defense','2026-07-26','ICT Lab 2','Lim, Cruz, Pendleton']])}</div>`,
    reports: `${hero('Reports','Export department analytics, delayed groups, defense results, and completion records.', [['Reports','file']])}<div class="feature-grid">${feature('Department Export','Export research office records.','file')}${feature('Completion Report','List completed and certificate-ready projects.','certificate','gold')}${feature('Alert Report','Export overdue or delayed records.','alert','danger')}</div>`,
    deadlines: `${hero('Department Deadlines','Publish department-wide research deadlines.', [['Deadlines','clock']])}<div class="grid grid-2 mt-16"><div class="card"><form class="form" onsubmit="fakeSubmit(event,'Deadline published to affected users.')"><input placeholder="Chapter 3 Final Submission"><input type="date"><select><option>All Groups</option><option>Capstone Only</option><option>Thesis Only</option></select><button class="btn btn-primary">Publish Deadline</button></form></div><div class="card"><h3 class="card-title">Published Deadlines</h3><div class="list"><div class="list-item"><span>Chapter 2 final deadline</span>${tag('Active')}</div><div class="list-item"><span>Defense request cutoff</span>${tag('Scheduled')}</div></div></div></div>`,
    profile: profileCard(roleMeta.admin)
  };
  return pages[tab] || overview;
}
function openDeanScheduleModal() { modal('Generate Defense Schedule', `<form class="form"><div class="form-row"><label>Defense Batch</label><input placeholder="Proposal Defense Batch 2"></div><div class="form-row-inline"><div class="form-row"><label>Date Range Start</label><input type="date"></div><div class="form-row"><label>Date Range End</label><input type="date"></div></div><div class="form-row"><label>Scheduling Rule</label><select><option>Use panelist availability matrix</option><option>Prioritize room availability</option><option>Manual scheduling</option></select></div></form>`, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal(); showToast('Defense schedule generated for dean/admin review.')">Generate</button>`); }
window.openDeanScheduleModal = openDeanScheduleModal;

function renderSystemAdmin(tab) {
  const s = data.system;
  const overview = `${hero('Super Admin Dashboard','Focused platform access management only: users, roles, access control, audit log, and settings.', [['User management','users'], ['Access control','lock'], ['Audit log','logs']], `<button class="btn btn-primary" onclick="openSuperAdminUserModal()">${icon('plus')} Add User</button>`)}<div class="grid grid-4 mt-16">${stat('Managed Users', s.users.length, 'Demo accounts', 'users')}${stat('Active Roles', 6, 'Student to Super Admin', 'shield','gold')}${stat('Access Policies', 5, 'Role boundaries', 'lock')}${stat('Audit Events', s.logs.length, 'Recent actions', 'logs')}</div><div class="card mt-16">${table(['Name','Email','Role','Status'], s.users.map(u => [u.name, u.email, u.role, tag(u.status)]))}</div>`;
  const pages = { overview,
    'user-management': `${hero('User Management','Add, edit, suspend, or restore platform users.', [['Users','users']], `<button class="btn btn-primary" onclick="openSuperAdminUserModal()">${icon('plus')} Add User</button>`)}<div class="card mt-16">${table(['Name','Email','Role','Status','Action'], s.users.map(u => [u.name, u.email, u.role, tag(u.status), `<button class="btn btn-sm" onclick="showToast('Edited ${u.name}.')">Edit</button>`]))}</div>`,
    roles: `${hero('Role Management','Assign and review role responsibilities without technical API/visitor metrics.', [['Roles','shield']])}<div class="card mt-16">${table(['Role','Main Purpose','Allowed Modules'], [['Student','Submit documents, view tasks, chat with adviser, track progress','Documents, Tasks, Chat, Video, Contribution'], ['Adviser','Review documents, assign tasks, monitor risk','Paper Review, Risk, Tasks, Contribution'], ['Professor','Create milestones and manage deadlines','Class Progress, Milestones, Certificates'], ['Panelist','Evaluate assigned defenses','Defense Schedule, Evaluation, Scoring'], ['Dean/Admin','Assign advisers/panelists and confirm defense','Assignments, Defense, Reports'], ['Super Admin','Manage accounts and system settings','Users, Roles, Access, Audit']])}</div>`,
    'access-control': `${hero('Access Control','Simple permission boundaries for every role.', [['Permissions','lock']])}<div class="card mt-16">${table(['Module','Student','Adviser','Professor','Panelist','Dean/Admin','Super Admin'], [['Document Review','Submit','Review','Monitor','View','Monitor','Audit'], ['Risk Dashboard','View own group','Manage','Monitor','No','Monitor','Audit'], ['Defense Schedule','View','Recommend','View','View','Confirm','Audit'], ['Certificate Automation','Preview','Verify','Generate','No','Approve','Configure']])}</div>`,
    'audit-log': `${hero('Audit Log','Logs focused on research workflow and access actions.', [['Audit','logs']])}<div class="card mt-16">${table(['Time','User','Action','Module','Level'], s.logs.map(l => [l.time,l.user,l.action,l.module,tag(l.level)]))}</div>`,
    settings: `${hero('System Settings','Basic prototype settings only. Technical API health, visitor analytics, and maintenance diagnostics were removed to keep the project focused.', [['Settings','settings']])}<div class="grid grid-2 mt-16"><div class="card"><h3 class="card-title">Workflow Settings</h3><div class="list"><div class="list-item"><span>Require adviser before student dashboard</span>${tag('Enabled')}</div><div class="list-item"><span>Document review highlights</span>${tag('Enabled')}</div><div class="list-item"><span>Certificate automation</span>${tag('Enabled')}</div></div></div><div class="card"><h3 class="card-title">Removed / Reduced</h3><p class="card-desc">API health, visitors, platform analytics, and maintenance diagnostics are intentionally not shown as major modules.</p></div></div>`,
    profile: profileCard(roleMeta['system-admin'])
  };
  return pages[tab] || overview;
}
function openSuperAdminUserModal() { modal('Add User', `<form class="form"><div class="form-row"><label>Full Name</label><input placeholder="New user name"></div><div class="form-row"><label>Email</label><input placeholder="name@university.edu.ph"></div><div class="form-row"><label>Role</label><select><option>Student</option><option>Adviser</option><option>Professor</option><option>Panelist</option><option>Dean Admin</option><option>Super Admin</option></select></div></form>`, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal(); showToast('User created in prototype.')">Create User</button>`); }
window.openSuperAdminUserModal = openSuperAdminUserModal;

function calendarGrid(events) { const days = Array.from({length: 28}, (_, i) => i + 1); return `<div class="card mt-16"><div class="calendar-grid">${days.map(d => { const e = events.find(x => Number(x.date.slice(-2)) === d); return `<div class="day-card"><strong>Jul ${d}</strong>${e ? `<div class="day-event">${e.title}</div>` : ''}</div>`; }).join('')}</div></div>`; }
function openConsultationModal() { modal('Request Consultation', `<form class="form"><div class="form-row"><label>Topic</label><input placeholder="Methodology validation"></div><div class="form-row-inline"><div class="form-row"><label>Date</label><input type="date"></div><div class="form-row"><label>Mode</label><select><option>Video Call</option><option>In Person</option><option>Chat Consultation</option></select></div></div><div class="form-row"><label>Notes</label><textarea placeholder="Questions or agenda."></textarea></div></form>`, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal(); showToast('Consultation request submitted.')">Submit Request</button>`); }
window.openConsultationModal = openConsultationModal;
function profileCard(meta) { return `${hero(`${meta.label} Profile`, 'Basic role profile and account information.', [['Profile','user']])}<div class="profile-card mt-16"><div class="avatar xl gold">${meta.initials}</div><h3>${meta.name}</h3><p>${meta.subtitle}</p><div class="flex wrap gap-8 mt-12">${tag(meta.label)}${tag(meta.email)}</div></div>`; }
function settingsCard(role) { return `${hero('Settings','Prototype settings for the current role.', [['Settings','settings']])}<div class="card mt-16"><div class="list"><div class="list-item"><span>Notifications</span>${tag('Enabled')}</div><div class="list-item"><span>Document preview before submission</span>${tag('Enabled')}</div><div class="list-item"><span>Certificate automation</span>${tag('Enabled')}</div></div></div>`; }

/* ADVISIO v3.0 role-access and workspace extension: keeps original visual system while adding requested modules. */
demoAccounts['leader01@university.edu.ph'] = 'group-leader';
roleMeta.student.subtitle = 'Research Group Member';
roleMeta['group-leader'] = { label: 'Group Leader', initials: 'JR', name: 'Juan Reyes', email: 'leader01@university.edu.ph', subtitle: 'Research Group Leader', defaultTab: 'overview' };
navGroups.student = [
  { title: 'My Research Work', items: [['overview', 'Dashboard', 'dashboard'], ['adviser-pool', 'Adviser', 'cap'], ['progress-tracker', 'Progress', 'chart'], ['tasks', 'My Tasks', 'checklist'], ['writing-editor', 'Writing Editor', 'edit'], ['submissions', 'My Documents', 'upload'], ['contribution', 'My Contribution', 'user']] },
  { title: 'Consultation', items: [['consultation-hub', 'Consultation', 'calendar'], ['chat', 'Chat', 'message'], ['video-call', 'Video Call', 'video']] },
  { title: 'Defense and Completion', items: [['defense-center', 'Defense', 'flag'], ['grades', 'Grades', 'star'], ['certificates', 'Certificates', 'certificate']] },
  { title: 'Account', items: [['notifications', 'Notifications', 'bell'], ['profile', 'Profile', 'user'], ['settings', 'Settings', 'settings']] }
];
navGroups['group-leader'] = [
  { title: 'Group Workspace', items: [['overview', 'Dashboard', 'dashboard'], ['members', 'Members', 'users'], ['leader-tasks', 'Task Management', 'checklist'], ['writing-editor', 'Writing Editor', 'edit'], ['submissions', 'Group Papers', 'upload'], ['contribution', 'Contribution', 'chart']] },
  { title: 'Consultation', items: [['consultation-hub', 'Consultation', 'calendar'], ['chat', 'Chat', 'message'], ['video-call', 'Video Call', 'video']] },
  { title: 'Defense and Completion', items: [['defense-center', 'Defense', 'flag'], ['grades', 'Grades', 'star'], ['certificates', 'Certificates', 'certificate']] },
  { title: 'Account', items: [['notifications', 'Notifications', 'bell'], ['profile', 'Profile', 'user'], ['settings', 'Settings', 'settings']] }
];
navGroups.adviser = [
  { title: 'Advising', items: [['overview', 'Dashboard', 'dashboard'], ['advisees', 'Advisees', 'users'], ['risk-dashboard', 'Risk Dashboard', 'alert'], ['requests', 'Advising Requests', 'mail']] },
  { title: 'Review Workflow', items: [['tasks', 'Tasks', 'checklist'], ['submissions', 'Submitted Papers', 'file'], ['paper-review', 'Paper Review', 'edit']] },
  { title: 'Consultation', items: [['schedule', 'Schedule', 'calendar'], ['chat', 'Chat', 'message'], ['video-call', 'Video Call', 'video'], ['consultation-form', 'Notes', 'clipboard']] },
  { title: 'Account', items: [['notifications', 'Notifications', 'bell'], ['profile', 'Profile', 'user']] }
];

data.memberTasks = [
  { title: 'Revise Chapter 1 scope paragraph', description: 'Improve problem scope and update adviser comments.', assignedTo: 'Juan Reyes', due: '2026-07-06', priority: 'High', status: 'In Progress', submission: 'Draft saved', remarks: 'Needs final checking', updated: '2026-07-03', attachment: 'Required', notes: 'Use approved problem statement.' },
  { title: 'Collect local RRL sources', description: 'Find recent local studies related to research management systems.', assignedTo: 'Mika Santos', due: '2026-07-07', priority: 'Medium', status: 'Pending', submission: 'Not submitted', remarks: 'Waiting for sources', updated: '2026-07-02', attachment: 'Optional', notes: 'Minimum 5 sources.' },
  { title: 'Update UI screenshots', description: 'Capture latest prototype screens for appendices.', assignedTo: 'Ella Cruz', due: '2026-07-08', priority: 'Medium', status: 'Submitted', submission: 'Submitted', remarks: 'For leader review', updated: '2026-07-03', attachment: 'Required', notes: 'Include captions.' },
  { title: 'Prepare testing evidence', description: 'Organize validation checklist and testing screenshots.', assignedTo: 'Noah Garcia', due: '2026-07-05', priority: 'High', status: 'Needs Revision', submission: 'Returned', remarks: 'Evidence incomplete', updated: '2026-07-03', attachment: 'Required', notes: 'Add tester names and dates.' }
];

data.reviewComments = [
  { type: 'Content', note: 'Strengthen the connection between the literature and the system workflow.', status: 'Open' },
  { type: 'Citation', note: 'Check APA formatting and add current local sources.', status: 'Revision Needed' },
  { type: 'Methodology', note: 'Clarify the validation criteria for usability testing.', status: 'Open' }
];

data.assignmentRecords = [
  { title: 'AI Crop Yield Prediction System', group: 'Group AI-CCS-01', adviser: 'Dr. Rachel Lim', panelists: 'Dr. Lisa Wong, Prof. Neil Santos, Prof. Mira Ramos', status: 'Assigned' },
  { title: 'Mobile Attendance System with QR Verification', group: 'Group SE-12', adviser: 'Dr. Rafael Cruz', panelists: 'Dr. Lisa Wong, Dr. Rachel Lim', status: 'For Update' }
];

function canStudentSeeTask(task, studentName = 'Juan Reyes') { return (task.assignedTo || '').toLowerCase().includes(studentName.toLowerCase()); }
function memberOptions() { return data.student.group.members.map(m => `<option>${m}</option>`).join(''); }
function memberCheckboxes() { return data.student.group.members.map((m, i) => `<label class="check-label"><input type="checkbox" name="leader-member" value="${m}" ${i===0?'checked':''}>${m}</label>`).join(''); }

function renderRole(role, tab) {
  if (role === 'student') return renderStudent(tab);
  if (role === 'group-leader') return renderGroupLeader(tab);
  if (role === 'adviser') return renderAdviser(tab);
  if (role === 'professor') return renderProfessor(tab);
  if (role === 'panelist') return renderPanelist(tab);
  if (role === 'admin') return renderAdmin(tab);
  if (role === 'system-admin') return renderSystemAdmin(tab);
  return renderStudent(tab);
}

function ownContributionModule() {
  const own = data.student.contributions[0];
  return `${hero('My Contribution','Your account only shows your own assigned role, tasks, submitted outputs, and progress. Other member contribution records are hidden from student accounts.', [['Private student view','lock'], ['Own progress only','user']], `<button class="btn btn-primary" onclick="showToast('Your contribution report was submitted for leader review.')">${icon('upload')} Submit My Update</button>`)}
  <div class="grid grid-4 mt-16">${stat('My Contribution', own.percent + '%', own.role, 'chart')}${stat('Assigned Tasks', data.memberTasks.filter(t=>canStudentSeeTask(t)).length, 'Visible to you', 'checklist','gold')}${stat('Completed Tasks', 1, 'Your own submissions', 'upload','success')}${stat('Privacy Rule','Active','Other members hidden','lock','warning')}</div>
  <div class="card mt-16">${table(['Name','Role','My Contribution','My Tasks','Status','Remarks'], [[own.name, own.role, own.percent + '%', own.tasks, tag(own.status), own.remarks]])}</div>
  <div class="card mt-16"><h3 class="card-title">Hidden Records Notice</h3><p class="card-desc">Contribution percentages, submissions, activity logs, and progress of other members are not displayed in a regular student account.</p></div>`;
}

function leaderContributionModule() {
  const rows = data.student.contributions.map(c => {
    const tasks = data.memberTasks.filter(t => t.assignedTo === c.name);
    return [c.name, c.role, tasks.length, tasks.filter(t=>t.status==='Completed' || t.status==='Submitted').length, tasks.filter(t=>t.status==='Pending' || t.status==='In Progress').length, c.percent + '%', 'Activity log available', c.remarks, '2026-07-03'];
  });
  return `${hero('Contribution Dashboard','Group Leader-only dashboard for individual member contribution, tasks, submissions, activity logs, remarks, and last active date.', [['Leader visibility only','shield'], ['Member activity logs','logs']], `<button class="btn btn-primary" onclick="showToast('Member participation evaluation saved.')">${icon('star')} Evaluate Participation</button>`)}
  <div class="grid grid-4 mt-16">${stat('Members', data.student.group.members.length, 'Full group visible', 'users')}${stat('Submitted Outputs', 3, 'Papers and sections', 'file','gold')}${stat('At-Risk Member','1','Needs follow-up','alert','danger')}${stat('Action Logging','Enabled','Every update recorded','shield')}</div>
  <div class="card mt-16">${table(['Member','Role','Assigned Tasks','Completed','Pending','Contribution','Activity Logs','Remarks','Last Active'], rows)}</div>`;
}

function leaderTaskManagementModule() {
  const taskRows = data.memberTasks.map(t => [t.assignedTo, t.title, t.due, tag(t.priority), tag(t.status), tag(t.submission), t.remarks, t.updated, `<div class="flex gap-8"><button class="btn btn-sm" onclick="openTaskDetails('${esc(t.title)}')">View</button><button class="btn btn-sm" onclick="openLeaderTaskModal()">Edit</button></div>`]);
  return `${hero('Group Leader Task Management','Create and monitor member tasks while keeping task visibility limited to assigned students only.', [['Create Task','plus'], ['Assigned student only','lock']], `<button class="btn btn-primary" onclick="openLeaderTaskModal()">${icon('plus')} Create Task</button>`)}
  <div class="grid grid-2 mt-16"><div class="card"><h3 class="card-title">Create Member Task</h3><form class="form" onsubmit="createLeaderTask(event)"><div class="form-row"><label>Task Title</label><input id="leader-task-title" placeholder="Write Chapter 2 synthesis" required></div><div class="form-row"><label>Task Description / Instructions</label><textarea id="leader-task-desc" placeholder="Detailed instructions and expected output"></textarea></div><div class="form-row"><label>Assigned Member or Members</label><div class="member-check-grid">${memberCheckboxes()}</div></div><div class="form-row-inline"><div class="form-row"><label>Deadline</label><input id="leader-task-due" type="date" required></div><div class="form-row"><label>Priority Level</label><select id="leader-task-priority"><option>Low</option><option selected>Medium</option><option>High</option></select></div></div><div class="form-row-inline"><div class="form-row"><label>Status</label><select id="leader-task-status"><option>Pending</option><option>In Progress</option><option>Submitted</option><option>Completed</option><option>Needs Revision</option></select></div><div class="form-row"><label>Attachments</label><select id="leader-task-attach"><option>Required</option><option>Optional</option><option>Not Required</option></select></div></div><div class="form-row"><label>Notes or Reminders</label><textarea id="leader-task-notes" placeholder="Reminder for assigned member"></textarea></div><button class="btn btn-primary">Create Task</button></form></div><div class="card"><h3 class="card-title">Visibility Rules</h3><div class="feature-grid">${feature('Assigned student only','Students only see tasks assigned to their account.','lock','warning')}${feature('Leader sees all','The group leader can view and monitor all member tasks.','eye','gold')}${feature('Other students hidden','Unassigned students cannot see submissions or progress for this task.','shield')}</div></div></div>
  <div class="card mt-16">${table(['Member Name','Assigned Task','Deadline','Priority','Status','Submission Status','Remarks','Last Updated','Action'], taskRows)}</div>`;
}

function createLeaderTask(event) {
  event.preventDefault();
  const checked = Array.from(document.querySelectorAll('input[name="leader-member"]:checked')).map(x => x.value);
  const assigned = checked.length ? checked.join(', ') : 'Juan Reyes';
  data.memberTasks.push({
    title: document.getElementById('leader-task-title').value,
    description: document.getElementById('leader-task-desc').value,
    assignedTo: assigned,
    due: document.getElementById('leader-task-due').value,
    priority: document.getElementById('leader-task-priority').value,
    status: document.getElementById('leader-task-status').value,
    submission: 'Not submitted', remarks: 'New task', updated: 'Now',
    attachment: document.getElementById('leader-task-attach').value,
    notes: document.getElementById('leader-task-notes').value
  });
  showToast('Task created. Only the assigned student can see it in their task list.');
  renderLayout('group-leader', 'leader-tasks');
}

function openLeaderTaskModal() {
  modal('Create / Update Member Task', `<form class="form"><div class="form-row"><label>Task Title</label><input placeholder="Task title"></div><div class="form-row"><label>Description / Instructions</label><textarea placeholder="Specific instructions"></textarea></div><div class="form-row"><label>Assigned Members</label><div class="member-check-grid">${memberCheckboxes()}</div></div><div class="form-row-inline"><div class="form-row"><label>Deadline</label><input type="date"></div><div class="form-row"><label>Priority</label><select><option>Low</option><option>Medium</option><option>High</option></select></div></div><div class="form-row-inline"><div class="form-row"><label>Status</label><select><option>Pending</option><option>In Progress</option><option>Submitted</option><option>Completed</option><option>Needs Revision</option></select></div><div class="form-row"><label>Attachments</label><input type="file"></div></div><div class="form-row"><label>Notes / Reminders</label><textarea></textarea></div></form>`, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal(); showToast('Task saved and activity log updated.')">Save Changes</button>`);
}

function studentAssignedTasksModule() {
  const visible = data.memberTasks.filter(t => canStudentSeeTask(t));
  const rows = visible.map(t => [t.title, t.description, t.due, tag(t.priority), tag(t.status), tag(t.submission), t.remarks, `<div class="flex gap-8"><button class="btn btn-sm" onclick="openTaskDetails('${esc(t.title)}')">View</button><button class="btn btn-sm btn-primary" onclick="showToast('Output submission panel opened.')">Submit Output</button></div>`]);
return `${hero('My Assigned Tasks','Only tasks assigned to your student account are visible here. Other members’ tasks, progress, percentages, and submissions are hidden.', [['Private tasks','lock'], ['Submit output','upload']])}<div class="card mt-16">${table(['Task','Instructions','Deadline','Priority','Status','Submission','Remarks','Action'], rows)}</div>`;
}

function openTaskModal(owner = 'adviser') {
  if (owner === 'group-leader') return openLeaderTaskModal();
  modal('Create / Edit Task', `<form class="form"><div class="form-row"><label>Task Title</label><input placeholder="Chapter revision task"></div><div class="form-row"><label>Description</label><textarea placeholder="Instructions and expected output."></textarea></div><div class="form-row-inline"><div class="form-row"><label>Assigned To</label><input placeholder="Group AI-CCS-01"></div><div class="form-row"><label>Deadline</label><input type="date"></div></div><div class="form-row-inline"><div class="form-row"><label>Priority</label><select><option>Low</option><option>Medium</option><option>High</option></select></div><div class="form-row"><label>Status</label><select><option>Pending</option><option>In Progress</option><option>Submitted</option><option>Completed</option><option>Needs Revision</option></select></div></div></form>`, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal(); showToast('Task saved in prototype.')">Save Task</button>`);
}

function writingEditorModule(role = 'student') {
  const title = role === 'group-leader' ? 'Research Group Writing Editor' : 'Student Writing Editor';
  const desc = role === 'group-leader' ? 'Write, organize, review, and prepare the group paper while keeping member task controls separate.' : 'Write and improve your assigned paper sections with formatting, comments, suggestions, autosave, version history, and export tools.';
  
  // Render tabs dynamically
  const tabNames = Object.keys(state.tabs);
  const tabHtml = tabNames.map((tab, idx) => {
    const isActive = tab === state.activeTab;
    const isDefault = defaultTabsList.includes(tab);
    const isSaved = state.tabSavedStatus[tab] !== false;
    return `<div class="doc-tab ${isActive ? 'active' : ''}" 
                 draggable="true" 
                 ondragstart="handleTabDragStart(event, '${esc(tab)}')" 
                 ondragover="handleTabDragOver(event)" 
                 ondrop="handleTabDrop(event, '${esc(tab)}', '${role}')"
                 onclick="switchTab('${esc(tab)}', '${role}')">
              ${!isSaved ? '<span class="doc-tab-unsaved" title="Unsaved changes"></span>' : ''}
              <span class="doc-tab-text">${esc(tab)}</span>
              ${isActive ? `
                <div class="doc-tab-actions">
                  <button class="doc-tab-btn rename" onclick="openRenameTabModal(event, '${esc(tab)}', '${role}')" title="Rename section">${icon('edit')}</button>
                  ${!isDefault ? `<button class="doc-tab-btn delete" onclick="deleteTab(event, '${esc(tab)}', '${role}')" title="Delete section">×</button>` : ''}
                </div>
              ` : ''}
            </div>`;
  }).join('');

  return `${hero(title, desc, [['Auto-save','clock'], ['Formatting tools','edit'], ['Writing assistant','spark']], `<button class="btn" onclick="saveDraft()">${icon('file')} Save Draft</button><button class="btn btn-primary" onclick="submitFinalPaper('${role}')">${icon('upload')} Submit Final Paper</button>`)}
  <div class="editor-shell mt-16">
    <section class="editor-main card">
      <div class="editor-toolbar" role="toolbar" aria-label="Writing tools">
        <select onchange="applyEditorBlock(this.value)"><option value="p">Paragraph</option><option value="h1">Title</option><option value="h2">Heading 1</option><option value="h3">Heading 2</option><option value="h4">Heading 3</option></select>
        <select onchange="editorCmd('fontName', this.value)"><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option></select>
        <select onchange="editorCmd('fontSize', this.value)"><option value="3">12</option><option value="4">14</option><option value="5">18</option><option value="6">24</option></select>
        <button class="btn btn-sm" onclick="editorCmd('bold')"><b>B</b></button><button class="btn btn-sm" onclick="editorCmd('italic')"><i>I</i></button><button class="btn btn-sm" onclick="editorCmd('underline')"><u>U</u></button><button class="btn btn-sm" onclick="editorCmd('strikeThrough')"><s>S</s></button>
        <input type="color" title="Text color" onchange="editorCmd('foreColor', this.value)"><input type="color" title="Highlight color" onchange="editorCmd('hiliteColor', this.value)">
        <button class="btn btn-sm" onclick="editorCmd('justifyLeft')">Left</button><button class="btn btn-sm" onclick="editorCmd('justifyCenter')">Center</button><button class="btn btn-sm" onclick="editorCmd('justifyRight')">Right</button><button class="btn btn-sm" onclick="editorCmd('justifyFull')">Justify</button>
        <button class="btn btn-sm" onclick="editorCmd('insertUnorderedList')">Bullets</button><button class="btn btn-sm" onclick="editorCmd('insertOrderedList')">Numbers</button><button class="btn btn-sm" onclick="insertChecklist()">Checklist</button>
        <button class="btn btn-sm" onclick="editorCmd('indent')">Indent</button><button class="btn btn-sm" onclick="editorCmd('outdent')">Outdent</button><button class="btn btn-sm" onclick="insertEditorTable()">Table</button><button class="btn btn-sm" onclick="insertEditorLink()">Link</button><button class="btn btn-sm" onclick="insertImagePlaceholder()">Image</button>
        <button class="btn btn-sm" onclick="editorCmd('undo')">Undo</button><button class="btn btn-sm" onclick="editorCmd('redo')">Redo</button><button class="btn btn-sm" onclick="exportPaper('pdf')">Export PDF</button><button class="btn btn-sm" onclick="exportPaper('docx')">Export DOCX</button>
      </div>
      
      <div class="document-tab-bar" id="document-tab-bar">
        ${tabHtml}
        <div class="tab-bar-controls">
          <button class="btn btn-sm btn-tab-action" onclick="openAddTabModal('${role}')" title="Add new section">${icon('plus')} Add</button>
          <button class="btn btn-sm btn-tab-action" onclick="moveActiveTab(-1, '${role}')" title="Move Left">←</button>
          <button class="btn btn-sm btn-tab-action" onclick="moveActiveTab(1, '${role}')" title="Move Right">→</button>
        </div>
      </div>
      
      <div class="editor-status">
        <span id="autosave-state">${state.tabSavedStatus[state.activeTab] ? 'Auto-save ready' : 'Saving draft...'}</span>
        <span id="word-count">0 words</span>
        <span>${tag('Suggestion Mode On')}</span>
        <span>${tag('Track Changes On')}</span>
      </div>
      <div class="paper-page" id="paper-editor" contenteditable="true" oninput="updateEditorStats()">
        ${state.tabs[state.activeTab] || ''}
      </div>
    </section>
    <aside class="editor-side">
      <div class="card"><h3 class="card-title">Academic Sections</h3><div class="section-chip-grid">${['Title Page','Abstract','Introduction','Review of Related Literature','Methodology','Results and Discussion','Conclusion','Recommendations','References','Appendices'].map(x=>`<button class="section-chip" onclick="switchTab('${x}', '${role}')">${x}</button>`).join('')}</div></div>
      <div class="card"><h3 class="card-title">Comments</h3><div class="list" id="editor-comments"><div class="list-item"><div><div class="item-title">Leader Comment</div><div class="item-sub">Clarify the system scope in the introduction.</div></div>${tag('Open')}</div><div class="list-item"><div><div class="item-title">Resolved Comment</div><div class="item-sub">Title page format fixed.</div></div>${tag('Resolved')}</div></div><div class="flex gap-8 mt-12"><button class="btn btn-sm" onclick="addEditorComment()">Add Comment</button><button class="btn btn-sm" onclick="showToast('Selected comment resolved.')">Resolve Comment</button></div></div>
      <div class="card assistant-card"><div class="flex-between"><h3 class="card-title">Writing Assistant <span class="tag tag-info" style="font-size: 10px; margin-left: 6px;">${esc(state.activeTab)}</span></h3>${icon('spark')}</div><p class="card-desc">Use suggestions to improve your own draft without replacing your work.</p><div class="assistant-actions">${['Generate research ideas','Improve grammar','Rewrite academically','Summarize text','Explain difficult part','Suggest titles','Suggest research questions','Suggest objectives','Organize related literature','Check clarity'].map(x=>`<button class="btn btn-sm" onclick="assistantSuggest('${x}')">${x}</button>`).join('')}</div><div id="assistant-output" class="assistant-output">Choose a writing support action to receive a short suggestion.</div></div>
      <div class="card"><h3 class="card-title">Version History</h3><div class="list"><div class="list-item"><span>Draft v4 · Today</span>${tag('Current')}</div><div class="list-item"><span>Draft v3 · July 2</span>${tag('Saved')}</div><div class="list-item"><span>Draft v2 · June 29</span>${tag('Returned')}</div></div></div>
    </aside>
  </div>`;
}

function editorCmd(command, value = null) { document.execCommand(command, false, value); updateEditorStats(); }
function applyEditorBlock(value) { document.execCommand('formatBlock', false, value); updateEditorStats(); }
function insertChecklist() { document.execCommand('insertHTML', false, '<ul class="checklist-list"><li><input type="checkbox"> New checklist item</li></ul>'); updateEditorStats(); }
function insertEditorTable() { document.execCommand('insertHTML', false, '<table class="paper-table"><tr><th>Variable</th><th>Description</th></tr><tr><td>Independent</td><td>System feature</td></tr></table>'); updateEditorStats(); }
function insertEditorLink() { const url = prompt('Enter link URL:', 'https://'); if (url) document.execCommand('createLink', false, url); }
function insertImagePlaceholder() { document.execCommand('insertHTML', false, '<div class="image-placeholder">Image placeholder / uploaded figure</div>'); updateEditorStats(); }
function insertSection(section) { document.execCommand('insertHTML', false, `<h2>${section}</h2><p>Write the ${section.toLowerCase()} content here.</p>`); updateEditorStats(); }
function addEditorComment() { const list = document.getElementById('editor-comments'); if (list) list.insertAdjacentHTML('afterbegin', `<div class="list-item"><div><div class="item-title">New Comment</div><div class="item-sub">Review this selected section.</div></div>${tag('Open')}</div>`); showToast('Comment added.'); }
const assistantSuggestionsMap = {
  'Title Page': {
    'Generate research ideas': 'Title Page: Suggest focusing on emerging technologies like "Predictive modeling in agricultural yields using remote sensing" or "Comparative analysis of machine learning frameworks in crop analytics."',
    'Improve grammar': 'Title Page: Ensure correct capitalization (Title Case) and that no punctuation marks like periods are used at the end of the title.',
    'Rewrite academically': 'Title Page: Frame the title as "An AI-Driven Framework for Precision Agriculture and Crop Yield Prediction" rather than "A system that predicts crops with AI."',
    'default': 'Title Page: Academic titles should be concise, mention key independent and dependent variables, and state the target system or context clearly.'
  },
  'Abstract': {
    'Generate research ideas': 'Abstract: Structure your abstract with: Background/Context, Problem Statement, Methodology, Key Findings, and Practical Significance.',
    'Improve grammar': 'Abstract: Check that past tense is used for methodology and results, and present tense for the final conclusions/general claims.',
    'Rewrite academically': 'Abstract: "This investigation proposes a novel machine learning architecture designed to mitigate yield forecasting inaccuracies" (Academic version).',
    'default': 'Abstract: Keep the abstract under 250 words, avoid citing literature, and ensure all keywords are listed at the bottom.'
  },
  'Introduction': {
    'Generate research ideas': 'Introduction: Discuss the global food security challenge, the local agricultural context in the Philippines, and the rise of smart farming.',
    'Improve grammar': 'Introduction: Ensure smooth transitions between paragraphs using logical connectors like "Consequently", "Moreover", and "In contrast".',
    'Rewrite academically': 'Introduction: "Agriculture remains the primary economic backbone, yet predictive inaccuracies continue to plague local farmers" rather than "Farmers have problems knowing how much they will harvest."',
    'default': 'Introduction: Establish the research hook, outline the problem gap clearly, and map the study objectives at the end of this section.'
  },
  'Review of Related Literature': {
    'Generate research ideas': 'Literature Review: Search for studies comparing CNNs, LSTMs, and Random Forests in agricultural prediction models.',
    'Improve grammar': 'Literature Review: Verify APA 7th edition in-text citation formatting. E.g., (Reyes & Santos, 2025) for two authors, or (Cruz et al., 2026) for three or more.',
    'Rewrite academically': 'Literature Review: "Recent empirical evidence suggests that remote sensing indices significantly enhance predictive confidence (Lim, 2025)."',
    'default': 'Literature Review: Group literature thematically rather than chronologically. Synthesize findings by highlighting consensus and disagreements among researchers.'
  },
  'Methodology': {
    'Generate research ideas': 'Methodology: Outline the data pipeline from collection (historical weather and soil parameters) to model training and web prototype deployment.',
    'Improve grammar': 'Methodology: Use passive voice and past tense for describing research procedures (e.g., "A descriptive research design was employed").',
    'Rewrite academically': 'Methodology: "System usability was measured using the System Usability Scale (SUS) with a sample of 30 agricultural technicians."',
    'default': 'Methodology: Clearly explain your system design, hardware/software specs, user participants, testing procedure, and statistical validation tools.'
  },
  'Results and Discussion': {
    'Generate research ideas': 'Results: Present training vs testing accuracy curves, RMSE values for yield predictions, and SUS score analysis.',
    'Improve grammar': 'Results: Ensure table titles are placed ABOVE the tables and figure captions are placed BELOW the figures.',
    'Rewrite academically': 'Results: "The model achieved a Mean Absolute Percentage Error (MAPE) of 4.2%, demonstrating high predictive capability."',
    'default': 'Results: Discuss the findings in relation to your objectives. Interpret what the numbers mean and compare them to results in the Literature Review.'
  },
  'Conclusion': {
    'Generate research ideas': 'Conclusion: Draw insights on how AI prediction bridges the gap between historical agricultural records and actionable decisions.',
    'Improve grammar': 'Conclusion: Keep this section concise and free of raw statistical numbers. Focus on general claims derived from the results.',
    'Rewrite academically': 'Conclusion: "In conclusion, the integration of predictive analytics into farm management workflows significantly optimizes resource allocation."',
    'default': 'Conclusion: Directly answer the research objectives stated in the Introduction based on your findings.'
  },
  'Recommendations': {
    'Generate research ideas': 'Recommendations: Suggest integrating real-time IoT sensors and weather APIs, and expanding prediction to other crop types.',
    'Improve grammar': 'Recommendations: Use action verbs to indicate future research steps (e.g., "Incorporate", "Expand", "Develop").',
    'Rewrite academically': 'Recommendations: "It is recommended that future iterations explore deep reinforcement learning to automate real-time irrigation responses."',
    'default': 'Recommendations: Provide actionable guidance for future developers, the university research office, and local agricultural departments.'
  },
  'References': {
    'Generate research ideas': 'References: Ensure you include DOIs for journal articles and exact URLs for online documentation.',
    'Improve grammar': 'References: Double-check italics for book titles and journal names, and verify lowercase capitalization rules for article titles.',
    'Rewrite academically': 'References: Format online records as: Author, A. A. (Year). Title of work. Publisher. URL',
    'default': 'References: Help with citation: Ensure references are alphabetized by the primary author\'s surname and use a hanging indent style.'
  },
  'Appendices': {
    'Generate research ideas': 'Appendices: Add mock usability survey questionnaires, code snippets for the model architecture, and database schemas.',
    'Improve grammar': 'Appendices: Label each appendix with capital letters (e.g., Appendix A: Usability Questionnaire, Appendix B: Source Code).',
    'Rewrite academically': 'Appendices: Include step-by-step user installation guides and full API endpoint documentation.',
    'default': 'Appendices: Place long tables, source code listings, permission letters, and raw data sheets here to keep the main text readable.'
  }
};

let autosaveTimeout = null;
let draggedTabName = null;

function switchTab(tabName, role) {
  const el = document.getElementById('paper-editor');
  if (el) {
    state.tabs[state.activeTab] = el.innerHTML;
  }
  state.tabSavedStatus[state.activeTab] = true;
  clearTimeout(autosaveTimeout);
  
  state.activeTab = tabName;
  renderLayout(role, 'writing-editor');
  
  const newEl = document.getElementById('paper-editor');
  if (newEl) {
    newEl.focus();
  }
}

function openAddTabModal(role) {
  modal('Add New Section Tab', `
    <form class="form" onsubmit="handleAddTab(event, '${role}')">
      <div class="form-row">
        <label for="new-tab-name">Section Name</label>
        <input id="new-tab-name" placeholder="e.g., Literature Review Synthesis" required />
      </div>
    </form>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.querySelector('#modal-root form').requestSubmit()">Add Section</button>
  `);
}

function handleAddTab(event, role) {
  event.preventDefault();
  const nameInput = document.getElementById('new-tab-name');
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) return;
  
  if (state.tabs[name] !== undefined) {
    showToast('A section with this name already exists.');
    return;
  }
  
  state.tabs[name] = `<h2>${name}</h2>\n<p>Write the ${name.toLowerCase()} content here.</p>`;
  state.tabSavedStatus[name] = true;
  state.activeTab = name;
  
  closeModal();
  showToast(`Section "${name}" added to tabs.`);
  renderLayout(role, 'writing-editor');
}

function openRenameTabModal(event, tabName, role) {
  event.stopPropagation();
  modal('Rename Section Tab', `
    <form class="form" onsubmit="handleRenameTab(event, '${esc(tabName)}', '${role}')">
      <div class="form-row">
        <label for="rename-tab-name">New Name for "${esc(tabName)}"</label>
        <input id="rename-tab-name" value="${esc(tabName)}" required />
      </div>
    </form>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.querySelector('#modal-root form').requestSubmit()">Rename</button>
  `);
}

function handleRenameTab(event, oldName, role) {
  event.preventDefault();
  const nameInput = document.getElementById('rename-tab-name');
  if (!nameInput) return;
  const newName = nameInput.value.trim();
  if (!newName) return;
  
  if (oldName === newName) {
    closeModal();
    return;
  }
  
  if (state.tabs[newName] !== undefined) {
    showToast('A section with this name already exists.');
    return;
  }
  
  const keys = Object.keys(state.tabs);
  const newTabs = {};
  const newSaved = {};
  
  keys.forEach(key => {
    if (key === oldName) {
      newTabs[newName] = state.tabs[oldName];
      newSaved[newName] = state.tabSavedStatus[oldName];
    } else {
      newTabs[key] = state.tabs[key];
      newSaved[key] = state.tabSavedStatus[key];
    }
  });
  
  state.tabs = newTabs;
  state.tabSavedStatus = newSaved;
  
  if (state.activeTab === oldName) {
    state.activeTab = newName;
  }
  
  closeModal();
  showToast(`Section renamed to "${newName}".`);
  renderLayout(role, 'writing-editor');
}

function deleteTab(event, tabName, role) {
  event.stopPropagation();
  if (defaultTabsList.includes(tabName)) {
    showToast('Default research sections cannot be deleted.');
    return;
  }
  
  modal('Delete Section Tab', `
    <p>Are you sure you want to delete the section <strong>"${esc(tabName)}"</strong>? This action cannot be undone.</p>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-danger" onclick="confirmDeleteTab('${esc(tabName)}', '${role}')">Delete</button>
  `);
}

function confirmDeleteTab(tabName, role) {
  delete state.tabs[tabName];
  delete state.tabSavedStatus[tabName];
  
  if (state.activeTab === tabName) {
    state.activeTab = Object.keys(state.tabs)[0] || 'Title Page';
  }
  
  closeModal();
  showToast(`Section "${tabName}" deleted.`);
  renderLayout(role, 'writing-editor');
}

function moveActiveTab(direction, role) {
  const keys = Object.keys(state.tabs);
  const index = keys.indexOf(state.activeTab);
  if (index === -1) return;
  
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= keys.length) {
    return;
  }
  
  const newTabs = {};
  const newSaved = {};
  
  const temp = keys[index];
  keys[index] = keys[newIndex];
  keys[newIndex] = temp;
  
  keys.forEach(key => {
    newTabs[key] = state.tabs[key];
    newSaved[key] = state.tabSavedStatus[key];
  });
  
  state.tabs = newTabs;
  state.tabSavedStatus = newSaved;
  
  showToast(`Section reordered.`);
  renderLayout(role, 'writing-editor');
}

function handleTabDragStart(event, tabName) {
  draggedTabName = tabName;
  event.dataTransfer.effectAllowed = 'move';
  event.target.classList.add('dragging');
}

function handleTabDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function handleTabDrop(event, targetTabName, role) {
  event.preventDefault();
  if (!draggedTabName || draggedTabName === targetTabName) return;
  
  const keys = Object.keys(state.tabs);
  const draggedIndex = keys.indexOf(draggedTabName);
  const targetIndex = keys.indexOf(targetTabName);
  
  if (draggedIndex === -1 || targetIndex === -1) return;
  
  keys.splice(draggedIndex, 1);
  keys.splice(targetIndex, 0, draggedTabName);
  
  const newTabs = {};
  const newSaved = {};
  keys.forEach(key => {
    newTabs[key] = state.tabs[key];
    newSaved[key] = state.tabSavedStatus[key];
  });
  
  state.tabs = newTabs;
  state.tabSavedStatus = newSaved;
  draggedTabName = null;
  
  showToast(`Sections reordered.`);
  renderLayout(role, 'writing-editor');
}

function submitFinalPaper(role) {
  const el = document.getElementById('paper-editor');
  if (el) {
    state.tabs[state.activeTab] = el.innerHTML;
  }
  state.tabSavedStatus[state.activeTab] = true;
  clearTimeout(autosaveTimeout);
  
  let combinedContent = '';
  const tabNames = Object.keys(state.tabs);
  
  tabNames.forEach(tab => {
    combinedContent += `<section class="submitted-paper-section" style="margin-bottom: 30px;">`;
    combinedContent += `<h2 style="border-bottom: 1px solid var(--border-secondary); padding-bottom: 6px;">${esc(tab)}</h2>`;
    combinedContent += state.tabs[tab];
    combinedContent += `</section>`;
  });
  
  const submissionFileName = `Final Paper - Combined Chapters (${tabNames.length} sections).pdf`;
  const newSubmission = {
    file: submissionFileName,
    status: 'For Review',
    version: 'v4',
    date: new Date().toISOString().split('T')[0]
  };
  
  data.student.submissions.unshift(newSubmission);
  
  modal('Paper Submitted Successfully', `
    <div class="card">
      <h3 class="card-title">Submission Confirmed</h3>
      <p class="card-desc">All <strong>${tabNames.length} document sections</strong> have been compiled into a single document and sent to your adviser, <strong>${data.student.group.adviser}</strong>.</p>
    </div>
    <div class="card mt-16" style="max-height: 300px; overflow-y: auto; background: var(--bg-secondary);">
      <h4 class="card-title">Document Outline (Combined Order)</h4>
      <ul style="padding-left: 20px; line-height: 1.6;">
        ${tabNames.map(t => {
          const rawText = state.tabs[t] ? state.tabs[t].replace(/<[^>]*>/g, '') : '';
          const wordCount = rawText.split(/\s+/).filter(Boolean).length;
          return `<li><strong>${esc(t)}</strong> (${wordCount} words)</li>`;
        }).join('')}
      </ul>
      <h4 class="card-title mt-16">Combined Document Preview</h4>
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; background: #fff; line-height: 1.6; font-size: 13px;">
        ${combinedContent}
      </div>
    </div>
  `, `
    <button class="btn btn-primary" onclick="closeModal()">Back to Workspace</button>
  `);
  
  showToast('Final paper compiled and submitted.');
}

function exportPaper(format) {
  const el = document.getElementById('paper-editor');
  if (el) {
    state.tabs[state.activeTab] = el.innerHTML;
  }
  state.tabSavedStatus[state.activeTab] = true;
  clearTimeout(autosaveTimeout);
  
  let combinedContent = '';
  const tabNames = Object.keys(state.tabs);
  tabNames.forEach(tab => {
    combinedContent += `<h2 style="text-align: center; text-transform: uppercase;">${esc(tab)}</h2>`;
    combinedContent += state.tabs[tab];
    combinedContent += `<hr style="margin: 30px 0; border: none; border-top: 1px dashed #cbd5e1;" />`;
  });
  
  modal(`Exporting Document as ${format.toUpperCase()}`, `
    <div class="card">
      <h3 class="card-title">Export Settings</h3>
      <p class="card-desc">Your <strong>${tabNames.length} document sections</strong> have been compiled in the correct order.</p>
    </div>
    <div class="card mt-16" style="max-height: 250px; overflow-y: auto; background: var(--bg-secondary);">
      <h4 class="card-title">Document Compilation Preview</h4>
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; background: #fff; font-family: 'Times New Roman', Georgia, serif; line-height: 2.0; font-size: 12px; color: #000;">
        ${combinedContent}
      </div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="closeModal(); showToast('Document download completed successfully.')">Download ${format.toUpperCase()}</button>
  `);
  
  showToast(`Preparing combined paper for ${format.toUpperCase()} export...`);
}

function assistantSuggest(action) {
  const out = document.getElementById('assistant-output');
  if (!out) return;
  const activeTab = state.activeTab || 'Title Page';
  
  const tabData = assistantSuggestionsMap[activeTab] || {};
  const suggestion = tabData[action] || tabData['default'] || `Suggestions for "${action}" on section "${activeTab}": Ensure your writing is precise, well-structured, and aligns with the Capstone guidelines.`;
  
  out.innerHTML = `
    <div style="font-weight: 700; color: var(--navy); margin-bottom: 6px; font-size: 12px; display: flex; align-items: center; gap: 4px;">
      ${icon('spark')} Context: ${esc(activeTab)}
    </div>
    <div>${suggestion}</div>
  `;
  showToast(`AI suggestion loaded for ${activeTab}`);
}

function updateEditorStats() {
  const el = document.getElementById('paper-editor');
  const wc = document.getElementById('word-count');
  const stateEl = document.getElementById('autosave-state');
  if (!el) return;
  
  const words = (el.innerText || '').trim().split(/\s+/).filter(Boolean).length;
  if (wc) wc.textContent = `${words} words`;
  
  // Save in memory
  state.tabs[state.activeTab] = el.innerHTML;
  state.tabSavedStatus[state.activeTab] = false;
  if (stateEl) stateEl.textContent = 'Saving draft...';
  
  // Show unsaved dot
  const activeTabEl = document.querySelector('.doc-tab.active');
  if (activeTabEl && !activeTabEl.querySelector('.doc-tab-unsaved')) {
    activeTabEl.insertAdjacentHTML('afterbegin', `<span class="doc-tab-unsaved" title="Unsaved changes"></span>`);
  }
  
  clearTimeout(autosaveTimeout);
  autosaveTimeout = setTimeout(() => {
    state.tabSavedStatus[state.activeTab] = true;
    if (stateEl) stateEl.textContent = 'Auto-saved just now';
    
    const dot = activeTabEl ? activeTabEl.querySelector('.doc-tab-unsaved') : null;
    if (dot) dot.remove();
  }, 1000);
}

function saveDraft() {
  const el = document.getElementById('paper-editor');
  if (el) {
    state.tabs[state.activeTab] = el.innerHTML;
  }
  state.tabSavedStatus[state.activeTab] = true;
  clearTimeout(autosaveTimeout);
  
  const stateEl = document.getElementById('autosave-state');
  if (stateEl) stateEl.textContent = 'Auto-saved just now';
  
  const activeTabEl = document.querySelector('.doc-tab.active');
  const dot = activeTabEl ? activeTabEl.querySelector('.doc-tab-unsaved') : null;
  if (dot) dot.remove();
  
  showToast('Draft saved. Version history updated.');
}

function adviserReviewModule() {
  return `${hero('Paper Review Mode','Advisers can review submitted papers using highlights, comments, revision tags, and recommendations without directly editing the student manuscript.', [['Review only','lock'], ['Highlights and comments','edit'], ['Return for revision','message']], `<button class="btn" onclick="addDocComment()">${icon('message')} Add Comment</button><button class="btn btn-primary" onclick="showToast('Paper marked as reviewed.')">${icon('checklist')} Mark Reviewed</button>`)}
  <div class="review-banner mt-16">${icon('shield')} Adviser access is limited to review, feedback, highlights, comments, section marks, and recommendations. The student remains the main editor of the paper.</div>
  <div class="document-review mt-16"><div class="document-page review-page" id="document-page"><h3>Chapter 2: Review of Related Literature</h3><p>The study discusses digital research management systems and their effect on student progress monitoring. <span class="highlight">The literature synthesis needs stronger connection to consultation workflows.</span></p><p id="dynamic-highlight">Role-based visibility protects student data by ensuring that students can view only their own assigned tasks and contribution records.</p><p><span class="margin-note">Needs Revision</span> The methodology section should explain how usability testing and adviser review comments will be measured.</p></div><aside class="comment-panel"><h3 class="card-title">Review Tools</h3><div class="review-tool-grid"><button class="btn btn-sm btn-primary" onclick="highlightDoc()">Highlight Text</button><button class="btn btn-sm" onclick="addDocComment()">Inline Comment</button><button class="btn btn-sm" onclick="addMarginComment()">Margin Comment</button><select id="feedback-tag"><option>Grammar</option><option>Content</option><option>Citation</option><option>Format</option><option>Methodology</option><option>Revision Needed</option><option>Approved</option></select><button class="btn btn-sm btn-danger" onclick="showToast('Section marked as Needs Revision.')">Mark Needs Revision</button><button class="btn btn-sm btn-success" onclick="showToast('Section marked as Approved.')">Mark Approved</button></div><h3 class="card-title mt-16">Feedback List</h3><div id="comment-list" class="list">${data.reviewComments.map(c=>`<div class="list-item"><div><div class="item-title">${c.type}</div><div class="item-sub">${c.note}</div></div>${tag(c.status)}</div>`).join('')}</div><div class="form mt-16"><label>General Adviser Feedback</label><textarea class="textarea" placeholder="Write overall feedback for the student group."></textarea><label>Final Recommendation</label><select><option>Return for Revision</option><option>Reviewed</option><option>Approved with Minor Revisions</option><option>Approved</option></select><button class="btn btn-primary" onclick="showToast('Paper returned to student with adviser feedback.')">Return Paper to Student</button></div></aside></div>`;
}
function addMarginComment() { const page = document.getElementById('document-page'); if (page) page.insertAdjacentHTML('beforeend', '<p class="annotation"><strong>Margin Comment:</strong> Revise this section and cite current sources.</p>'); showToast('Margin comment added.'); }

function documentPreviewModule(role = 'student') {
  if (role === 'adviser') return adviserReviewModule();
  return `${hero('Document Submission Preview','Upload, preview, save drafts, and submit the research paper for review. Use the writing editor when editing paper content.', [['Preview','file'], ['Submit paper','upload']], `<button class="btn" onclick="routeTo('#/app/${role === 'group-leader' ? 'group-leader' : 'student'}/writing-editor')">${icon('edit')} Open Writing Editor</button><button class="btn btn-primary" onclick="openUploadModal()">${icon('upload')} Submit Paper</button>`)}<div class="document-review mt-16"><div class="document-page"><h3>Current Draft Preview</h3><p><strong>AI Crop Yield Prediction System</strong></p><p>This preview shows the submitted version only. Editing is handled in the writing editor so paper ownership remains with students.</p><p class="highlight">Latest adviser note: strengthen the Review of Related Literature synthesis.</p></div><aside class="comment-panel"><h3 class="card-title">Submission Tools</h3><div class="feature-grid">${feature('Save Draft','Keep an editable draft before final submission.','file')}${feature('Submit Final Paper','Send the final version for adviser review.','upload','gold')}${feature('Export','Generate PDF or DOCX outputs.','download')}</div></aside></div><div class="card mt-16">${table(['File','Version','Date','Status'], data.student.submissions.map(x => [x.file, x.version, x.date, tag(x.status)]))}</div>`;
}

function consultationJoinModule(role = 'student') {
  const isAdviser = role === 'adviser';
  const rows = data.adviser.consultations.map(c => [c.group, isAdviser ? c.group : 'Dr. Rachel Lim', c.date, c.time, tag(c.status === 'Accepted' ? 'Available' : 'Upcoming'), `<button class="btn btn-sm btn-primary" onclick="routeTo('#/app/${role}/video-call')">Join Consultation Call</button>`]);
  return `${hero('Consultation Hub','View scheduled consultations and join available calls without creating another meeting manually.', [['Scheduled consultation','calendar'], ['Join process visible','video']], `<button class="btn btn-primary" onclick="openConsultationModal()">${icon('plus')} Request Consultation</button>`)}<div class="card mt-16">${table(['Group','Adviser / Group','Date','Time','Meeting Status','Action'], rows)}</div><div class="grid grid-3 mt-16">${feature('Upcoming','Join button is visible but only active when the meeting window is available.','clock')}${feature('Available / Ongoing','Users can enter the pre-join lobby and check devices.','video','gold')}${feature('Ended','Records remain visible for notes and history.','file')}</div>`;
}

function videoCallModule(role = 'student') {
  return `${hero('Video Consultation','Clear consultation access with meeting status, pre-join lobby, larger video area, full-screen mode, participant grid, chat, and call controls.', [['Join Call','video'], ['Pre-join lobby','eye'], ['Full screen','maximize']], `<button class="btn btn-primary" onclick="enterCall()">${icon('video')} Join Now</button>`)}
  <div class="call-access-card mt-16"><div><h3>Chapter 2 Revision Consultation</h3><p>Group AI-CCS-01 · Dr. Rachel Lim · July 3, 2026 · 10:00 AM</p></div><div class="flex wrap gap-8">${tag('Available')}${tag('Ongoing')}</div><button class="btn btn-primary" onclick="enterCall()">Join Consultation Call</button></div>
  <div class="video-shell enhanced-call mt-16" id="video-shell"><section class="video-stage"><div class="meeting-title"><div><h3>Pre-Join Lobby</h3><p>Check camera and microphone before entering the consultation.</p></div>${tag('Camera and microphone ready')}</div><div class="prejoin-lobby" id="prejoin-lobby"><div class="main-video"><div class="avatar xl gold">${role === 'adviser' ? 'RL' : 'JR'}</div><strong>${role === 'adviser' ? 'Dr. Rachel Lim' : 'Juan Reyes'}</strong><span>Camera preview placeholder</span></div><div class="call-controls"><button class="btn" onclick="showToast('Microphone toggled.')">Mute / Unmute</button><button class="btn" onclick="showToast('Camera toggled.')">Camera On / Off</button><button class="btn btn-primary" onclick="enterCall()">Join Now</button><button class="btn" onclick="routeTo('#/app/${role}/consultation-hub')">Cancel / Go Back</button></div></div><div class="live-call hidden" id="live-call"><div class="main-video call-focus"><div class="avatar xl gold">RL</div><strong>Dr. Rachel Lim</strong><span>Speaker focus mode</span></div><div class="participant-row large-grid"><div class="participant-tile"><div class="avatar">JR</div><span>Juan Reyes</span></div><div class="participant-tile"><div class="avatar">MS</div><span>Mika Santos</span></div><div class="participant-tile"><div class="avatar">EC</div><span>Ella Cruz</span></div><div class="participant-tile"><div class="avatar">NG</div><span>Noah Garcia</span></div></div><div class="call-controls floating-controls"><button class="btn" onclick="showToast('Microphone toggled.')">Mute</button><button class="btn" onclick="showToast('Camera toggled.')">Camera</button><button class="btn" onclick="showToast('Screen sharing started.')">Share Screen</button><button class="btn" onclick="toggleCallFullscreen()">Full Screen</button><button class="btn btn-danger" onclick="showToast('Left the call.')">Leave Call</button></div></div></section><aside class="meeting-notes"><h3 class="card-title">Call Panel</h3><div class="list"><div class="list-item"><span>Meeting title</span>${tag('Chapter 2 Revision')}</div><div class="list-item"><span>Meeting time</span>${tag('10:00 AM')}</div><div class="list-item"><span>Participants</span>${tag('5')}</div></div><h3 class="card-title mt-16">Chat</h3><div class="mini-chat"><p><strong>Adviser:</strong> Let us start with the RRL synthesis.</p><p><strong>Leader:</strong> Ready, Ma’am.</p></div><textarea class="textarea" placeholder="Type call chat message"></textarea><button class="btn btn-primary mt-12" onclick="showToast('Call chat message sent.')">Send Chat</button></aside></div>`;
}
function enterCall() { const pre = document.getElementById('prejoin-lobby'); const live = document.getElementById('live-call'); if (pre && live) { pre.classList.add('hidden'); live.classList.remove('hidden'); showToast('Joined the consultation call.'); } }
function toggleCallFullscreen() { const shell = document.getElementById('video-shell'); if (shell) shell.classList.toggle('call-fullscreen'); showToast('Full screen mode toggled.'); }

function renderStudent(tab) {
  const s = data.student;
  const selected = data.advisers.find(a => a.id === state.selectedAdviser) || data.advisers[0];
  const overview = `${hero('Student Dashboard','Access your own tasks, your own contribution, writing tools, submissions, consultations, and defense requirements.', [['Private visibility','lock'], ['Writing workspace','edit'], ['Consultation','video']], `<button class="btn" onclick="resetAdviserGate()">${icon('cap')} Change Adviser Gate</button><button class="btn btn-primary" onclick="routeTo('#/app/student/writing-editor')">${icon('edit')} Open Writing Editor</button>`)}<div class="grid grid-4 mt-16">${stat('Research Progress', `${s.group.progress}%`, s.group.stage, 'chart')}${stat('My Tasks', data.memberTasks.filter(t=>canStudentSeeTask(t)).length, 'Assigned to me only', 'checklist','gold')}${stat('My Contribution','35%','Only my record visible','user','warning')}${stat('Unread Updates', s.notifications.filter(n => n.status === 'Unread').length, 'Requires attention', 'bell','warning')}</div><div class="module-layout"><div class="card"><h3 class="card-title">Privacy Rules Active</h3><div class="feature-grid">${feature('Own tasks only','You cannot see other members’ tasks, progress, submissions, or percentages.','lock','warning')}${feature('Editor access','You can write and improve your assigned sections.','edit','gold')}${feature('Writing support','Assistant suggestions help improve your draft without replacing your work.','spark')}</div></div><div class="card"><h3 class="card-title">Selected Adviser</h3><div class="flex gap-12 mt-12"><div class="avatar lg gold">${initials(selected.name)}</div><div><div class="item-title">${selected.name}</div><div class="item-sub">${selected.expertise}</div><div class="flex wrap gap-8 mt-8">${tag(selected.status)}${tag(selected.load)}</div></div></div></div></div>`;
  const pages = { overview,
    'adviser-pool': `${hero('Adviser Pool','View adviser credentials, expertise, advising load, and recommendation score before selection.', [['Smart matching','spark']], `<button class="btn" onclick="resetAdviserGate()">${icon('cap')} Reopen Selection Flow</button>`)}<div class="grid grid-3 mt-16">${data.advisers.map(adviserSelectionCard).join('')}</div>`,
    'progress-tracker': `${hero('Research Progress Tracker','Detailed milestone tracker from proposal to certificate release.', [['Milestones','chart']])}<div class="card mt-16"><div class="stepper">${['Proposal Stage','Chapter 1','Chapter 2','Chapter 3','Pre-defense','Final Defense','Certificate Release'].map((x,i)=>`<div class="step ${i<2?'done':i===2?'current':''}"><div class="step-no">${i+1}</div><div><div class="item-title">${x}</div><div class="item-sub">${i<2?'Completed and verified.':i===2?'Active revision cycle.':'Locked until previous requirement is complete.'}</div></div>${tag(i<2?'Done':i===2?'Current':'Locked')}</div>`).join('')}</div></div>`,
    tasks: studentAssignedTasksModule(),
    'writing-editor': writingEditorModule('student'),
    submissions: documentPreviewModule('student'),
    contribution: ownContributionModule(),
    'consultation-hub': consultationJoinModule('student'),
    chat: chatModule('student'),
    'video-call': videoCallModule('student'),
    'defense-center': `${hero('Defense Center','View defense readiness checklist, proposed schedule, and requirements.', [['Readiness checklist','checklist'], ['Defense schedule','flag']])}<div class="grid grid-2 mt-16"><div class="card"><h3 class="card-title">Defense Readiness</h3><div class="stepper">${['Adviser endorsement','Required chapters approved','Similarity check submitted','Panel assigned','Schedule confirmed'].map((x,i)=>`<div class="step ${i<2?'done':i===2?'current':''}"><div class="step-no">${i+1}</div><div><div class="item-title">${x}</div><div class="item-sub">${i<2?'Complete.':i===2?'In progress.':'Pending dean/admin action.'}</div></div>${tag(i<2?'Done':i===2?'Current':'Pending')}</div>`).join('')}</div></div><div class="card"><h3 class="card-title">Proposed Defense</h3>${table(['Type','Date','Venue','Status'], [['Proposal Defense','2026-07-24','CCS Seminar Hall', tag('For Confirmation')]])}</div></div>`,
    grades: `${hero('Grades and Remarks','View panelist scores, recommendations, and research remarks.', [['Evaluation results','star']])}<div class="card mt-16">${table(['Criteria','Panelist','Score','Remarks'], s.grades.map(g => [g.criteria, g.panelist, g.score, g.remarks]))}</div>`,
    certificates: `${hero('Certificates','Preview QR-verified completion certificates after approval.', [['QR certificate','qr'], ['Completion record','certificate']], `<button class="btn btn-primary" onclick="showToast('Certificate preview opened.')">${icon('certificate')} Preview Certificate</button>`)}<div class="grid grid-2 mt-16"><div class="certificate-preview"><div class="brand-mark">A</div><h2>Certificate of Research Completion</h2><p>Presented to Group AI-CCS-01 after final approval and panel score verification.</p><div class="qr-box">QR</div></div><div class="card"><h3 class="card-title">Certificate Status</h3><div class="list"><div class="list-item"><span>Final defense result</span>${tag('Pending')}</div><div class="list-item"><span>Dean approval</span>${tag('Pending')}</div><div class="list-item"><span>QR verification</span>${tag('Ready after approval')}</div></div></div></div>`,
    notifications: `${hero('Notifications','Central feed for task, document, consultation, defense, and certificate updates.', [['Alerts','bell']])}<div class="card mt-16"><div class="list">${s.notifications.map(n => `<div class="list-item"><div><div class="item-title">${n.title}</div><div class="item-sub">${n.body}</div></div>${tag(n.status)}</div>`).join('')}</div></div>`,
    profile: profileCard(roleMeta.student), settings: settingsCard('student') };
  return pages[tab] || overview;
}

function renderGroupLeader(tab) {
  const s = data.student;
  const overview = `${hero('Group Leader Dashboard','Manage group members, assign tasks, monitor progress, review contribution, write the group paper, and coordinate consultations.', [['Leader controls','shield'], ['Task assignment','checklist'], ['Contribution dashboard','chart']], `<button class="btn btn-primary" onclick="openLeaderTaskModal()">${icon('plus')} Create Task</button>`)}<div class="grid grid-4 mt-16">${stat('Group Progress', `${s.group.progress}%`, s.group.stage, 'chart')}${stat('Group Members', s.group.members.length, 'Full list visible', 'users','gold')}${stat('Member Tasks', data.memberTasks.length, 'All assignments', 'checklist')}${stat('At-Risk Items', 1, 'Needs revision', 'alert','danger')}</div><div class="card mt-16">${table(['Member','Role','Contribution','Status','Remarks'], data.student.contributions.map(c=>[c.name,c.role,c.percent+'%',tag(c.status),c.remarks]))}</div>`;
  const pages = { overview,
    members: `${hero('Group Members','View all members and their roles, activity, assigned outputs, and contribution status.', [['Members','users']])}<div class="card mt-16">${table(['Member','Role','Assigned Tasks','Contribution','Status','Remarks'], data.student.contributions.map(c=>[c.name,c.role,data.memberTasks.filter(t=>t.assignedTo.includes(c.name)).length,c.percent+'%',tag(c.status),c.remarks]))}</div>`,
    'leader-tasks': leaderTaskManagementModule(),
    'writing-editor': writingEditorModule('group-leader'),
    submissions: documentPreviewModule('group-leader'),
    contribution: leaderContributionModule(),
    'consultation-hub': consultationJoinModule('group-leader'),
    chat: chatModule('student'),
    'video-call': videoCallModule('group-leader'),
    'defense-center': renderStudent('defense-center'), grades: renderStudent('grades'), certificates: renderStudent('certificates'),
    notifications: `${hero('Leader Notifications','Task, paper, consultation, and member progress updates.', [['Notifications','bell']])}<div class="card mt-16"><div class="list"><div class="list-item"><span>Noah submitted testing evidence late</span>${tag('Unread')}</div><div class="list-item"><span>Chapter 2 paper returned with comments</span>${tag('Unread')}</div></div></div>`,
    profile: profileCard(roleMeta['group-leader']), settings: settingsCard('group-leader') };
  return pages[tab] || overview;
}

function renderAdviser(tab) {
  const a = data.adviser;
  const overview = `${hero('Adviser Dashboard','Review submitted papers, highlight text, add comments, mark revisions, monitor risk, and conduct consultations. Full student writing editor access is not shown for adviser accounts.', [['Paper review only','lock'], ['Risk monitoring','alert'], ['Consultation','video']], `<button class="btn btn-primary" onclick="routeTo('#/app/adviser/paper-review')">${icon('edit')} Open Paper Review</button>`)}<div class="grid grid-4 mt-16">${stat('Advisee Groups', a.advisees.length, 'Active workspaces', 'users')}${stat('High Risk', a.riskFactors.filter(r=>r.risk==='High').length, 'Needs immediate action', 'alert','danger')}${stat('Papers for Review', a.reviews.length, 'Chapters and letters', 'file')}${stat('Consultations', a.consultations.length, 'This week', 'calendar','gold')}</div><div class="module-layout"><div class="card"><h3 class="card-title">My Advisees</h3>${table(['Group','Project','Members','Progress','Risk'], a.advisees.map(g => [g.group, g.title, g.members, pct(g.progress), tag(g.risk)]))}</div><div class="card"><h3 class="card-title">Adviser Access Boundary</h3><div class="feature-grid">${feature('Paper Review only','Review papers using comments, highlights, and revision marks.','edit','gold')}${feature('No direct editing','Original student paper content stays with students.','lock','warning')}${feature('Review suggestions','Changes are suggested and returned for student revision.','message')}</div></div></div>`;
  const pages = { overview,
    advisees: `${hero('My Advisees','Assigned research groups with progress and monitoring.', [['Group management','users']])}<div class="grid grid-3 mt-16">${a.advisees.map(g => `<div class="card"><div class="flex-between"><div><h3 class="card-title">${g.group}</h3><p class="card-desc">${g.title}</p></div>${tag(g.risk)}</div><div class="mt-12">${pct(g.progress)}</div><p class="card-desc mt-12">${g.factors}</p><button class="btn btn-sm mt-12" onclick="showToast('Opened ${g.group} review workspace.')">${icon('folder')} Review Workspace</button></div>`).join('')}</div>`,
    'risk-dashboard': riskDashboard(), requests: `${hero('Advising Requests','Accept or reject student/group adviser requests.', [['Applications','mail']])}<div class="card mt-16">${table(['Group','Topic','Date','Status','Action'], a.requests.map(r => [r.group, r.topic, r.date, tag(r.status), `<div class="flex gap-8"><button class="btn btn-sm btn-success" onclick="showToast('Accepted ${r.group}.')">Accept</button><button class="btn btn-sm btn-danger" onclick="showToast('Rejected ${r.group}.')">Reject</button></div>`]))}</div>`,
    tasks: taskCreationModule('adviser'), submissions: `${hero('Submitted Papers','Review uploaded research files and their status.', [['Review queue','file']])}<div class="card mt-16">${table(['Document','Group','Due','Status','Action'], a.reviews.map(r => [r.doc, r.group, r.due, tag(r.status), `<button class="btn btn-sm" onclick="routeTo('#/app/adviser/paper-review')">Open Paper Review</button>`]))}</div>`,
    'paper-review': adviserReviewModule(), schedule: consultationJoinModule('adviser'), chat: chatModule('adviser'), 'video-call': videoCallModule('adviser'),
    'consultation-form': `${hero('Consultation Notes','Record consultation details, required revisions, next deadline, and follow-up status.', [['Notes','clipboard']])}<div class="grid grid-2 mt-16"><div class="card"><form class="form" onsubmit="fakeSubmit(event,'Consultation note saved.')"><div class="form-row"><label>Group</label><select><option>Group AI-CCS-01</option><option>Group SE-12</option></select></div><div class="form-row"><label>Topics Discussed</label><textarea placeholder="Research design, revisions, prototype testing"></textarea></div><div class="form-row"><label>Next Deadline</label><input type="date"></div><button class="btn btn-primary">Save Notes</button></form></div><div class="card"><h3 class="card-title">Recent Notes</h3><div class="list"><div class="list-item"><span>Chapter 2 synthesis revision</span>${tag('Follow-up Needed')}</div><div class="list-item"><span>Prototype evidence upload</span>${tag('Completed')}</div></div></div></div>`,
    notifications: `${hero('Adviser Notifications','Updates for submissions, risks, consultations, and review queues.', [['Alerts','bell']])}<div class="card mt-16"><div class="list"><div class="list-item"><span>Group SE-12 became high risk</span>${tag('Unread')}</div><div class="list-item"><span>New paper submitted for review</span>${tag('Unread')}</div></div></div>`, profile: profileCard(roleMeta.adviser) };
  return pages[tab] || overview;
}

function renderPanelist(tab) {
  const p = data.panelist;
  const overview = `${hero('Panelist Dashboard','Access assigned research papers, review documents, add comments, rate work, and submit recommendations without private student task visibility.', [['Assigned papers','folder'], ['Evaluation','star']])}<div class="grid grid-3 mt-16">${stat('Assigned Defenses', p.defenses.length, 'This period', 'flag')}${stat('Assigned Papers', 2, 'Review access only', 'file','gold')}${stat('Private Tasks','Hidden','No student task access','lock','warning')}</div><div class="card mt-16">${table(['Group','Project','Date','Time','Venue','Status'], p.defenses.map(d => [d.group, d.title, d.date, d.time, d.venue, tag(d.status)]))}</div>`;
  const pages = { overview,
    'defense-schedule': `${hero('Defense Schedule','View assigned defense schedules only.', [['Schedule','calendar']])}<div class="card mt-16">${table(['Group','Project','Date','Time','Venue','Status'], p.defenses.map(d => [d.group, d.title, d.date, d.time, d.venue, tag(d.status)]))}</div>`,
    'assigned-projects': `${hero('Assigned Research Papers','Panelists can access assigned manuscripts for review but cannot access private student task management.', [['Documents','folder'], ['Privacy boundary','lock']])}<div class="card mt-16">${table(['Group','Project','Document','Access','Action'], p.defenses.map(d => [d.group, d.title, 'Full Manuscript.pdf', tag('Assigned Only'), `<button class="btn btn-sm" onclick="showToast('Opened assigned manuscript for ${d.group}.')">Open Paper</button>`]))}</div>`,
    evaluation: `${hero('Evaluation','Add comments, ratings, and recommendations for assigned papers.', [['Evaluation','clipboard']])}<div class="grid grid-2 mt-16"><div class="card"><h3 class="card-title">Evaluation Form</h3><form class="form" onsubmit="fakeSubmit(event,'Panel evaluation saved.')"><select><option>Group AI-CCS-01</option><option>Group SE-12</option></select><textarea placeholder="Comments and recommendations"></textarea><select><option>Approved</option><option>Approved with minor revisions</option><option>Major revisions</option></select><button class="btn btn-primary">Save Evaluation</button></form></div><div class="card"><h3 class="card-title">Rating</h3><div class="rubric">${['Clarity','Methodology','Prototype','Presentation'].map(c=>`<div class="rubric-row"><strong>${c}</strong><input type="number" min="0" max="100" value="90"><button class="btn btn-sm">Save</button></div>`).join('')}</div></div></div>`,
    'scoring-panel': `${hero('Scoring Panel','Submit panel scores using a simple digital rubric.', [['Rubric','star']])}<div class="card mt-16"><div class="rubric">${['Problem and Scope','Methodology','System Prototype','Presentation'].map(c => `<div class="rubric-row"><strong>${c}</strong><input type="number" min="0" max="100" value="90"><button class="btn btn-sm" onclick="showToast('Saved ${c} score.')">Save</button></div>`).join('')}</div><button class="btn btn-primary mt-16" onclick="showToast('Scores submitted to dean/admin.')">Submit Scores</button></div>`,
    history: `${hero('Historical Records','Stored grading records, scores, and recommendations from prior defenses.', [['Archive','logs']])}<div class="card mt-16">${table(['Group','Defense','Grade','Recommendation'], p.history.map(h => [h.group, h.defense, h.grade, h.recommendation]))}</div>`, notifications: `${hero('Panelist Notifications','Defense reminders and score submission updates.', [['Notifications','bell']])}<div class="card mt-16"><div class="list"><div class="list-item"><span>Defense schedule posted for Group AI-CCS-01</span>${tag('Unread')}</div><div class="list-item"><span>Score sheet pending</span>${tag('Unread')}</div></div></div>`, profile: profileCard(roleMeta.panelist) };
  return pages[tab] || overview;
}

function renderAdmin(tab) {
  const a = data.admin;
  const assignmentTable = `<div class="card mt-16">${table(['Research Title','Group Name','Adviser','Panelists','Status','Action'], data.assignmentRecords.map(r=>[r.title,r.group,r.adviser,r.panelists,tag(r.status),`<button class="btn btn-sm btn-primary" onclick="openAssignmentModal('${r.group}')">Update Assignment</button>`]))}</div>`;
  const overview = `${hero('Dean/Admin Dashboard','Assign advisers and panelists through clear modals, confirm defense schedules, monitor department progress, and review reports.', [['Assignment modal','users'], ['Defense scheduling','flag']], `<button class="btn btn-primary" onclick="openAssignmentModal()">${icon('users')} Assign Adviser / Panelists</button>`)}<div class="grid grid-5 mt-16">${a.department.map((x,i) => stat(x.label, x.value, x.trend, i===0?'users':i===1?'briefcase':i===2?'cap':i===3?'certificate':'flag')).join('')}</div>${assignmentTable}`;
  const pages = { overview,
    'department-overview': `${hero('Department Overview','High-level college and department research status.', [['Metrics','building']])}<div class="grid grid-5 mt-16">${a.department.map((x,i)=>stat(x.label,x.value,x.trend,i===0?'users':i===1?'briefcase':i===2?'cap':i===3?'certificate':'flag')).join('')}</div>`,
    'progress-analytics': `${hero('Progress Analytics','Track proposal, chapters, pre-defense, and final defense completion.', [['Analytics','chart']])}<div class="card mt-16">${table(['Stage','Groups','Completion Progress','Action'], a.stages.map(s => [s.stage, s.groups, pct(s.percent), `<button class="btn btn-sm" onclick="showToast('Filtered ${s.stage}.')">View Groups</button>`]))}</div>`,
    alerts: `${hero('Alerts','Overdue tasks, missing evaluations, unassigned advisers, and delayed groups.', [['Alert center','alert']])}<div class="grid grid-2 mt-16">${a.alerts.map(al => `<div class="card"><div class="flex-between"><div><h3 class="card-title">${al.title}</h3><p class="card-desc">${al.count} records require dean/admin review.</p></div><span class="icon-box ${al.status === 'High' ? 'danger' : 'warning'}">${icon('alert')}</span></div><div class="mt-12">${tag(al.status)}</div><button class="btn btn-sm mt-12" onclick="showToast('Opened alert: ${al.title}.')">Review</button></div>`).join('')}</div>`,
    faculty: `${hero('Faculty Assignments','View adviser and panelist loads before assignment.', [['Faculty load','users']], `<button class="btn btn-primary" onclick="openAssignmentModal()">${icon('users')} Open Assignment Modal</button>`)}<div class="grid grid-3 mt-16">${data.advisers.map(f => `<div class="card"><div class="flex gap-10"><div class="avatar lg gold">${initials(f.name)}</div><div><h3 class="card-title">${f.name}</h3><p class="card-desc">${f.expertise}</p></div></div><div class="flex wrap gap-8 mt-12">${tag(f.load)}${tag(f.status)}</div></div>`).join('')}</div>`,
    'assign-advisers': `${hero('Assign Advisers','Assign or update advisers using a modal with research title, group name, adviser selection, panelist selection, and confirmation.', [['Assignment modal','cap']], `<button class="btn btn-primary" onclick="openAssignmentModal()">${icon('cap')} Assign Adviser</button>`)}${assignmentTable}`,
    'assign-panelists': `${hero('Assign Panelists','Select multiple panelists, remove selected panelists, and confirm assignment from one organized modal.', [['Panel assignment','shield']], `<button class="btn btn-primary" onclick="openAssignmentModal()">${icon('shield')} Assign Panelists</button>`)}${assignmentTable}`,
    'defense-schedule': `${hero('Defense Schedule','Confirm official defense schedules by group, room, panel, and date.', [['Defense management','flag']], `<button class="btn btn-primary" onclick="openDeanScheduleModal()">${icon('calendar')} Generate Schedule</button>`)}<div class="card mt-16">${table(['Group','Type','Date','Room','Panel'], [['Group AI-CCS-01','Proposal Defense','2026-07-24','CCS Seminar Hall','Wong, Santos, Ramos'], ['Group SE-12','Prototype Defense','2026-07-26','ICT Lab 2','Lim, Cruz, Pendleton']])}</div>`,
    reports: `${hero('Reports','Export department analytics, delayed groups, defense results, and completion records.', [['Reports','file']])}<div class="feature-grid">${feature('Department Export','Export research office records.','file')}${feature('Completion Report','List completed and certificate-ready projects.','certificate','gold')}${feature('Alert Report','Export overdue or delayed records.','alert','danger')}</div>`,
    deadlines: `${hero('Department Deadlines','Publish department-wide research deadlines.', [['Deadlines','clock']])}<div class="grid grid-2 mt-16"><div class="card"><form class="form" onsubmit="fakeSubmit(event,'Deadline published to affected users.')"><input placeholder="Chapter 3 Final Submission"><input type="date"><select><option>All Groups</option><option>Capstone Only</option><option>Thesis Only</option></select><button class="btn btn-primary">Publish Deadline</button></form></div><div class="card"><h3 class="card-title">Published Deadlines</h3><div class="list"><div class="list-item"><span>Chapter 2 final deadline</span>${tag('Active')}</div><div class="list-item"><span>Defense request cutoff</span>${tag('Scheduled')}</div></div></div></div>`, profile: profileCard(roleMeta.admin) };
  return pages[tab] || overview;
}

function openAssignmentModal(groupName = 'Group AI-CCS-01') {
  modal('Assign Adviser and Panelists', `<form class="form"><div class="form-row"><label>Research Title</label><input value="AI Crop Yield Prediction System"></div><div class="form-row"><label>Group Name</label><input value="${groupName}"></div><div class="form-row"><label>Adviser</label><select><option>Dr. Rachel Lim</option><option>Dr. Rafael Cruz</option><option>Prof. Arthur Pendleton</option></select></div><div class="form-row"><label>Panelist</label><div class="form-row-inline"><select id="panelist-select"><option>Dr. Lisa Wong</option><option>Prof. Neil Santos</option><option>Prof. Mira Ramos</option><option>Dr. Rafael Cruz</option></select><button type="button" class="btn" onclick="addPanelistChip()">Add Panelist</button></div></div><div class="selected-panelists" id="selected-panelists"><span class="panelist-chip">Dr. Lisa Wong <button type="button" onclick="this.parentElement.remove()">×</button></span><span class="panelist-chip">Prof. Neil Santos <button type="button" onclick="this.parentElement.remove()">×</button></span></div></form>`, `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal(); showToast('Assignment confirmed and assigned people updated.')">Confirm Assignment</button>`);
}
function addPanelistChip() { const sel = document.getElementById('panelist-select'); const box = document.getElementById('selected-panelists'); if (sel && box) box.insertAdjacentHTML('beforeend', `<span class="panelist-chip">${sel.value} <button type="button" onclick="this.parentElement.remove()">×</button></span>`); }

window.createLeaderTask = createLeaderTask;
window.openLeaderTaskModal = openLeaderTaskModal;
window.editorCmd = editorCmd;
window.applyEditorBlock = applyEditorBlock;
window.insertChecklist = insertChecklist;
window.insertEditorTable = insertEditorTable;
window.insertEditorLink = insertEditorLink;
window.insertImagePlaceholder = insertImagePlaceholder;
window.insertSection = insertSection;
window.addEditorComment = addEditorComment;
window.assistantSuggest = assistantSuggest;
window.updateEditorStats = updateEditorStats;
window.saveDraft = saveDraft;
window.addMarginComment = addMarginComment;
window.enterCall = enterCall;
window.toggleCallFullscreen = toggleCallFullscreen;
window.openAssignmentModal = openAssignmentModal;
window.addPanelistChip = addPanelistChip;

window.switchTab = switchTab;
window.openAddTabModal = openAddTabModal;
window.handleAddTab = handleAddTab;
window.openRenameTabModal = openRenameTabModal;
window.handleRenameTab = handleRenameTab;
window.deleteTab = deleteTab;
window.confirmDeleteTab = confirmDeleteTab;
window.moveActiveTab = moveActiveTab;
window.handleTabDragStart = handleTabDragStart;
window.handleTabDragOver = handleTabDragOver;
window.handleTabDrop = handleTabDrop;
window.submitFinalPaper = submitFinalPaper;
window.exportPaper = exportPaper;


function parseHash() {
  const hash = window.location.hash || '#/login';
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'login' || !parts[0]) return renderAuthPage('login');
  if (parts[0] === 'register') return renderAuthPage('register');
  if (parts[0] === 'forgot-password') return renderAuthPage('forgot');
  if (parts[0] === 'first-login-setup') return renderAuthPage('first-login');
  if (parts[0] === 'student-onboarding') return renderStudentOnboarding();
  if (parts[0] === 'app') { const role = roleMeta[parts[1]] ? parts[1] : 'student'; const tab = parts[2] || roleMeta[role].defaultTab; return renderLayout(role, tab); }
  renderAuthPage('login');
}
window.addEventListener('hashchange', parseHash);
parseHash();
