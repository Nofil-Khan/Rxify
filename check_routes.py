"""Quick route listing script — run to verify new endpoints exist."""
from app.main import app

new_patterns = ["/hospital/doctors", "/hospital/appointments", "/patient/appointments", "/doctor/appointments/slots"]
print("\n=== NEW ENDPOINTS ===")
for r in sorted(app.routes, key=lambda x: getattr(x, 'path', '')):
    path = getattr(r, 'path', '')
    methods = getattr(r, 'methods', set())
    if any(p in path for p in new_patterns):
        print(f"  {sorted(methods)} {path}")

print("\n=== ALL IMPORTS OK ===")
