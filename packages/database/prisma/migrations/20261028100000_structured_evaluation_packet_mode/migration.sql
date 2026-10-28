ALTER TABLE "defense_packets" DROP CONSTRAINT "defense_packet_evaluation_mode_check";
ALTER TABLE "defense_packets" ADD CONSTRAINT "defense_packet_evaluation_mode_check"
  CHECK ("evaluation_mode" IN ('RUBRIC', 'PDF', 'STRUCTURED'));
ALTER TABLE "defense_packets" ADD CONSTRAINT "defense_packet_structured_snapshot_check"
  CHECK ("evaluation_mode" <> 'STRUCTURED' OR "structured_form" IS NOT NULL);
