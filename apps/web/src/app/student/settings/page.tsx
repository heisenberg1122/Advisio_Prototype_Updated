import { Card, CardTitle } from "@/components/ui/Card";

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[18px] font-medium mb-0.5">Settings</h1>
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          Account preferences and profile settings
        </p>
      </div>

      <Card>
        <CardTitle icon="ti-user" className="mb-4">
          Profile
        </CardTitle>
        <div className="empty">
          <i className="ti ti-settings text-2xl block mb-2" aria-hidden="true" />
          Settings will be available in a future release
        </div>
      </Card>
    </div>
  );
}
