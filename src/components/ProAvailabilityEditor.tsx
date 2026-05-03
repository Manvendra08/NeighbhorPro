import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getProAvailability, updateProAvailability } from "../services/firestoreService";
import { captureError } from "../lib/sentry";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const ALL_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM"
];

export default function ProAvailabilityEditor() {
  const { user } = useAuth();
  const [avail, setAvail] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getProAvailability(user.uid).then(data => {
      if (!alive) return;
      if (!data) {
        const defaultSlots = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];
        const defaultAvail: Record<string, any> = {
          monday: { active: true, slots: defaultSlots },
          tuesday: { active: true, slots: defaultSlots },
          wednesday: { active: true, slots: defaultSlots },
          thursday: { active: true, slots: defaultSlots },
          friday: { active: true, slots: defaultSlots },
          saturday: { active: false, slots: [] },
          sunday: { active: false, slots: [] },
        };
        setAvail(defaultAvail);
      } else {
        setAvail(data);
      }
      setLoading(false);
    }).catch((error: unknown) => {
      if (alive) setLoading(false);
      captureError(error, { operation: "get_pro_availability", uid: user?.uid });
    });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    if (!user || !avail) return;
    setSaving(true); setSaved(false);
    try {
      await updateProAvailability(user.uid, avail);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { operation: "save_pro_availability", uid: user.uid });
    }
    setSaving(false);
  };

  const toggleDay = (day: string) => {
    if (!avail) return;
    setAvail({ ...avail, [day]: { ...avail[day], active: !avail[day]?.active } });
  };

  const toggleFullDay = (day: string) => {
    if (!avail) return;
    const dayData = avail[day] || { active: true, slots: [] };
    const isFull = (dayData.slots || []).length === ALL_SLOTS.length;
    setAvail({ 
      ...avail, 
      [day]: { 
        ...dayData, 
        active: true, 
        slots: isFull ? [] : [...ALL_SLOTS] 
      } 
    });
  };

  const toggleSlot = (day: string, slot: string) => {
    if (!avail) return;
    const dayData = avail[day] || { active: true, slots: [] };
    const slots = dayData.slots || [];
    const newSlots = (slots as string[]).includes(slot) 
        ? slots.filter((s: string) => s !== slot) 
        : [...slots, slot];
    
    // sort slots by their appearance in ALL_SLOTS
    newSlots.sort((a: string, b: string) => ALL_SLOTS.indexOf(a) - ALL_SLOTS.indexOf(b));
    setAvail({ ...avail, [day]: { ...dayData, slots: newSlots } });
  };

  if (loading || !avail) return <div style={{ textAlign: "center", padding: 40 }}><div className="loader" style={{ margin: "0 auto" }}/></div>;

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>My Availability</h3>
      <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Set the days and times you are available for consultations.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {DAYS.map(day => (
          <div key={day} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: avail[day]?.active ? 16 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, textTransform: "capitalize" }}>
                  <input type="checkbox" checked={!!avail[day]?.active} onChange={() => toggleDay(day)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
                  {day}
                </label>
                
                {avail[day]?.active && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--accent)", background: "rgba(var(--accent-rgb), 0.1)", padding: "4px 12px", borderRadius: 20 }}>
                    <input 
                      type="checkbox" 
                      checked={(avail[day].slots || []).length === ALL_SLOTS.length} 
                      onChange={() => toggleFullDay(day)}
                      style={{ width: 14, height: 14, accentColor: "var(--accent)" }}
                    />
                    Available full day
                  </label>
                )}
              </div>
              <span className="text-muted text-sm">{avail[day]?.active ? "Available" : "Unavailable"}</span>
            </div>

            {avail[day]?.active && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ALL_SLOTS.map(slot => (
                  <button
                    key={slot}
                    onClick={() => toggleSlot(day, slot)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      border: `1px solid ${avail[day].slots.includes(slot) ? "var(--accent)" : "var(--border)"}`,
                      background: avail[day].slots.includes(slot) ? "var(--accent)" : "transparent",
                      color: avail[day].slots.includes(slot) ? "#fff" : "var(--text)",
                      cursor: "pointer"
                    }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Availability"}</button>
        {saved && <span style={{ color: "var(--success)" }}>✓ Saved!</span>}
      </div>
    </div>
  );
}
