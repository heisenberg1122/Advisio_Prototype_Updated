import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Pause, Play } from "lucide-react";
import { researchRoles } from "./role-experience-data";
import { SharedResearchRecord } from "./SharedResearchRecord";

type RoleNetworkProps = { active: number; onSelect: (index: number) => void };

export function RoleNetwork({ active, onSelect }: RoleNetworkProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [inView, setInView] = useState(false);
  const [floating, setFloating] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) {
          setRevealed(true);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next = active;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = (active + 1) % researchRoles.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (active + researchRoles.length - 1) % researchRoles.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = researchRoles.length - 1;
    else return;
    event.preventDefault();
    onSelect(next);
    const tabs =
      tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    tabs?.[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={`lp-role-network ${revealed ? "is-revealed" : ""}`}
      data-floating={floating && inView}
    >
      <svg
        className="lp-role-connections"
        viewBox="0 0 1000 500"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {researchRoles.map((role, index) => (
          <g key={role.name} className={active === index ? "is-active" : ""}>
            <path
              className="lp-role-connection-track"
              d={role.path}
              pathLength="1"
            />
            <path
              className="lp-role-connection-selected"
              d={role.path}
              pathLength="1"
            />
            <circle cx={role.x * 10} cy={role.y * 5} r="3" />
          </g>
        ))}
      </svg>
      <div className="lp-role-record-position">
        <SharedResearchRecord audience={researchRoles[active].name} />
      </div>
      <div
        className="lp-role-nodes"
        ref={tabsRef}
        role="tablist"
        aria-label="Explore by role"
        onKeyDown={onKeyDown}
      >
        {researchRoles.map(({ name, sublabel, action, Icon, x, y }, index) => (
          <div
            key={name}
            className="lp-role-node-position"
            style={
              {
                "--role-x": `${x}%`,
                "--role-y": `${y}%`,
                "--role-index": index,
              } as CSSProperties
            }
          >
            <button
              type="button"
              className="lp-role-node"
              role="tab"
              id={`role-tab-${index}`}
              aria-selected={active === index}
              aria-controls="role-panel"
              tabIndex={active === index ? 0 : -1}
              onClick={() => onSelect(index)}
            >
              <span className="lp-role-node-icon">
                <Icon size={19} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="lp-role-node-label">
                <strong>{name}</strong>
                {sublabel && <small>{sublabel}</small>}
              </span>
              <span className="lp-role-node-dot" aria-hidden="true" />
            </button>
            <span className="lp-role-node-action" aria-hidden="true">
              {action}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="lp-role-motion-control"
        aria-pressed={floating}
        onClick={() => setFloating((current) => !current)}
      >
        {floating ? <Pause size={12} /> : <Play size={12} />}
        {floating ? "Pause floating" : "Resume floating"}
      </button>
    </div>
  );
}
