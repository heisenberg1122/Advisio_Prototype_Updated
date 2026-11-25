import { useTheme } from "@/providers/theme-provider";
import { StatusDot } from "@/components/ui/advisio";
import { RoleBand } from "@/components/dashboards/RoleScreenParts";
import "./system-admin.css";

const eyebrow = "System administration";

const roleMatrix = [
  { role: "Student Researcher", read: true, write: true, grading: false, admin: false },
  { role: "Research Adviser", read: true, write: true, grading: true, admin: false },
  { role: "Course Professor", read: true, write: true, grading: true, admin: false },
  { role: "Defense Panelist", read: true, write: false, grading: true, admin: false },
  { role: "College Dean / Admin", read: true, write: true, grading: true, admin: true },
  { role: "System Administrator", read: true, write: true, grading: true, admin: true },
];

function Mark({ on }: { on: boolean }) {
  return (
    <span className="sa-mark" data-on={on} role="img" aria-label={on ? "Allowed" : "Not allowed"}>
      <i className={`ti ${on ? "ti-check" : "ti-minus"}`} aria-hidden="true" />
    </span>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="sa-note">
      <i className="ti ti-info-circle" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function RolePermissionsScreen() {
  return (
    <div className="rs">
      <RoleBand
        eyebrow={eyebrow}
        title="Role permissions"
        titleId="sa-roles-title"
        meta="What each kind of account can do across Advisio."
        counts={[
          { label: "Roles", value: roleMatrix.length },
          { label: "Capabilities", value: 4 },
        ]}
        countsLabel="Role permission summary"
      />
      <div className="rs-table">
        <table className="sa-matrix">
          <caption className="sr-only">Capabilities available to each account role</caption>
          <thead>
            <tr>
              <th data-guide="sa-role-matrix" scope="col">Role</th>
              <th scope="col">Workspace read</th>
              <th scope="col">Manuscript write</th>
              <th scope="col">Evaluation and grading</th>
              <th scope="col">College admin</th>
            </tr>
          </thead>
          <tbody>
            {roleMatrix.map((item) => (
              <tr key={item.role}>
                <td>{item.role}</td>
                <td><Mark on={item.read} /></td>
                <td><Mark on={item.write} /></td>
                <td><Mark on={item.grading} /></td>
                <td><Mark on={item.admin} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>View only. To change what a person can do, assign their roles in Users.</Note>
    </div>
  );
}

function StatusTile({ icon, title, text, status, guide }: { icon: string; title: string; text: string; status: string; guide?: string }) {
  return (
    <div className="sa-status">
      <span className="sa-status-icon" aria-hidden="true"><i className={`ti ${icon}`} /></span>
      <div className="sa-status-text">
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <span data-guide={guide}><StatusDot tone="done">{status}</StatusDot></span>
    </div>
  );
}

export function SystemConfigurationScreen() {
  return (
    <div className="rs">
      <RoleBand
        eyebrow={eyebrow}
        title="System configuration"
        titleId="sa-config-title"
        meta="Current platform status."
        counts={[
          { label: "Platform", value: "Normal" },
          { label: "Cache", value: "Active" },
        ]}
        countsLabel="Platform status"
      />
      <div className="sa-status-grid">
        <StatusTile icon="ti-circle-check" title="Maintenance mode" text="Locks the platform for scheduled institutional upgrades." status="Normal" guide="sa-system-config" />
        <StatusTile icon="ti-bolt" title="Query and session cache" text="Caches user role matrices and taxonomy trees to optimize performance." status="Active" />
      </div>
      <Note>Status only. Nothing on this page can be changed.</Note>
    </div>
  );
}

export function DatabaseBackupsScreen() {
  return (
    <div className="rs">
      <RoleBand
        eyebrow={eyebrow}
        title="Database backups"
        titleId="sa-backups-title"
        meta="Daily snapshot schedule configured via cloud infrastructure."
        counts={[
          { label: "Schedule", value: "Daily" },
          { label: "Status", value: "Running" },
        ]}
        countsLabel="Backup status"
      />
      <StatusTile icon="ti-database" title="Automated database snapshots" text="Daily snapshot schedule configured via cloud infrastructure." status="Running" guide="sa-backup-status" />
      <Note>Status only. Nothing on this page can be changed.</Note>
    </div>
  );
}

export function PortalSettingsScreen() {
  const { theme, setTheme, collegeTheme, headingFontPreference, setHeadingFontPreference } = useTheme();
  const modes = [
    { id: "light", label: "Light", icon: "ti-sun" },
    { id: "dark", label: "Dark", icon: "ti-moon" },
    { id: "system", label: "System", icon: "ti-device-laptop" },
  ] as const;
  return (
    <div className="rs">
      <RoleBand eyebrow={eyebrow} title="Portal settings" titleId="sa-settings-title" meta="Your display preferences." />
      <section className="rh-panel" aria-labelledby="sa-appearance-title">
        <div className="rh-head"><h2 id="sa-appearance-title">Appearance</h2></div>
        <p className="rh-lede">The original Advisio palette and display mode are saved to your administrator account.</p>
        <div className="sa-swatch">
          <span style={{ backgroundColor: collegeTheme.referenceColor }} aria-hidden="true" />
          <span className="rs-text">
            <strong>Default Advisio theme</strong>
            <small>System Administrators always use the original University of the Assumption-inspired palette.</small>
          </span>
          <i className="ti ti-check" role="img" aria-label="Active theme" />
        </div>
        <p className="rh-subhead">Heading font</p>
        <div className="sa-modes" role="group" aria-label="Heading font">
          {(["STANDARD", "SERIF"] as const).map((font) => (
            <button key={font} type="button" className="sa-mode" aria-pressed={headingFontPreference === font} onClick={() => setHeadingFontPreference(font)}>
              {font === "SERIF" ? "Serif" : "Standard"}
            </button>
          ))}
        </div>
        <p className="rh-subhead">Display mode</p>
        <div className="sa-modes" role="group" aria-label="Display mode">
          {modes.map((mode) => (
            <button key={mode.id} type="button" className="sa-mode" aria-pressed={theme === mode.id} onClick={() => setTheme(mode.id)}>
              <i className={`ti ${mode.icon}`} aria-hidden="true" /> {mode.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
