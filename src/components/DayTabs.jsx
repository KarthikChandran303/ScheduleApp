import { DATE_OPTIONS } from '../lib/schedule';

export default function DayTabs({ activeDay, onSelect }) {
  return (
    <div className="day-tabs" role="tablist">
      {DATE_OPTIONS.map((dateOption) => (
        <button
          key={dateOption.value}
          role="tab"
          aria-selected={activeDay === dateOption.value}
          className={`day-tab ${activeDay === dateOption.value ? 'active' : ''}`}
          onClick={() => onSelect(dateOption.value)}
        >
          {dateOption.label}
        </button>
      ))}
    </div>
  );
}
