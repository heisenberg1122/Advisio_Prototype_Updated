import { useState } from "react";
import { ArrowUpRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { RoleNetwork } from "./RoleNetwork";
import { researchRoles } from "./role-experience-data";
import "./role-experience.css";

export function RoleExperience() {
  const [active, setActive] = useState(0);
  const role = researchRoles[active];
  const Icon = role.Icon;

  return (
    <section
      id="roles"
      className="lp-roles lp-section lp-role-ecosystem"
      data-scene
    >
      <div className="lp-container">
        <div className="lp-roles-heading">
          <p className="lp-eyebrow">03 / The people behind the research</p>
          <h2>
            One research record.
            <br />
            <span>Many responsibilities.</span>
          </h2>
          <p className="lp-roles-intro">
            Every role sees the research from a different perspective, while the
            work stays connected.
          </p>
        </div>
        <RoleNetwork active={active} onSelect={setActive} />
        <div
          id="role-panel"
          role="tabpanel"
          aria-labelledby={`role-tab-${active}`}
          tabIndex={0}
          className="lp-role-panel lp-role-details"
        >
          <div className="lp-role-description" key={role.name}>
            <p className="lp-micro">{role.name}</p>
            <h3>{role.title}</h3>
            <p>{role.copy}</p>
            <Link to="/login" className="lp-text-link">
              Find your workspace <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="lp-role-preview" key={active}>
            <div className="lp-row">
              <span className="lp-role-preview-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="lp-sample">
                Illustrative workspace · Sample data
              </span>
            </div>
            <h4>{role.workspace}</h4>
            <div className="lp-role-research">
              <FileText size={15} aria-hidden="true" />
              <span>Advisio research project</span>
            </div>
            <div className="lp-role-rows">
              {role.rows.map(([title, status]) => (
                <div key={title}>
                  <span>{title}</span>
                  <span>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="lp-role-note">
          Available workspaces and actions follow your institution&apos;s
          assigned permissions.
        </p>
      </div>
    </section>
  );
}
