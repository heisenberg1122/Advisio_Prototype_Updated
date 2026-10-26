import {
  GraduationCap,
  Users,
  Award,
  ShieldCheck,
  Building2,
} from "lucide-react";

export function PlatformValueStrip() {
  return (
    <section className="landing-community">
      <div className="landing-container">
        <p className="landing-eyebrow">
          A shared space for your academic community
        </p>
        <div className="landing-community-roles">
          {[
            { name: "Researchers", icon: GraduationCap },
            { name: "Advisers", icon: Users },
            { name: "Panelists", icon: Award },
            { name: "Research ethics", icon: ShieldCheck },
            { name: "Research offices", icon: Building2 },
          ].map(({ name, icon: Icon }) => (
            <div key={name}>
              <Icon size={19} strokeWidth={1.5} aria-hidden="true" />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
