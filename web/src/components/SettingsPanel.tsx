import { useEffect, useState } from 'react';
import { fetchAutoDraftSetting, updateAutoDraftSetting } from '../api';
import type { AutoDraftSetting } from '../types';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function parseDays(daysOfWeek: string): Set<number> {
  return new Set(daysOfWeek.split(',').map(Number));
}

function serializeDays(days: Set<number>): string {
  return [...days].sort((a, b) => a - b).join(',');
}

export function SettingsPanel() {
  const [setting, setSetting] = useState<AutoDraftSetting | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('18:00');
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAutoDraftSetting()
      .then((data) => {
        setSetting(data);
        setEnabled(data.enabled);
        setTime(data.time);
        setDays(parseDays(data.daysOfWeek));
      })
      .catch((e) => setError(String(e)));
  }, []);

  const toggleDay = (day: number) => {
    setSaved(false);
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    if (days.size === 0) {
      setError('요일을 하나 이상 선택하세요.');
      return;
    }
    setSaving(true);
    try {
      const result = await updateAutoDraftSetting({ enabled, time, daysOfWeek: serializeDays(days) });
      setSetting(result);
      setSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!setting) {
    return (
      <section className="panel">
        <p className="empty">{error ?? '불러오는 중...'}</p>
      </section>
    );
  }

  return (
    <section className="panel settings-card">
      <div className="settings-card-header">
        <div>
          <h2>자동 업무일지 초안 생성</h2>
          <p className="settings-description">
            지정한 요일 · 시각에 활성 프로젝트마다 오늘자 업무일지를 초안으로만 자동 생성합니다. 확정은 하지 않으니
            언제든 내용을 확인하고 고칠 수 있어요.
          </p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setSaved(false);
            }}
          />
          <span className="toggle-switch-track" />
        </label>
      </div>

      <div className={`settings-schedule${enabled ? '' : ' settings-schedule-disabled'}`}>
        <div className="settings-field">
          <span className="settings-field-label">시각</span>
          <input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setSaved(false);
            }}
            disabled={!enabled}
          />
        </div>

        <div className="settings-field">
          <span className="settings-field-label">요일</span>
          <div className="settings-day-picker">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                className={days.has(i) ? 'settings-day settings-day-active' : 'settings-day'}
                onClick={() => toggleDay(i)}
                disabled={!enabled}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="settings-footer">
        <span className="settings-last-run">
          {setting.lastRunDate ? `마지막 자동 생성일: ${setting.lastRunDate}` : '아직 자동 생성된 적이 없습니다.'}
        </span>
        <div className="settings-save-group">
          {saved && !error && <span className="settings-saved-hint">저장됨 ✓</span>}
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </section>
  );
}
