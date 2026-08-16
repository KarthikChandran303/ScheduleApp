export default function ActivityCard({ activity, assignedNames, conflicts, isScheduler, onEdit, onDelete }) {
  return (
    <div className="activity-card">
      <div className="activity-time">
        {activity.startTime}–{activity.endTime}
      </div>
      <div className="activity-body">
        <div className="activity-title">{activity.title}</div>
        <div className="activity-people">
          {assignedNames.length ? assignedNames.join(', ') : 'Unassigned'}
        </div>
        {conflicts.length > 0 && (
          <div className="activity-conflict">
            ⚠ {conflicts.map((c) => c.name).join(', ')} marked unavailable at this time
          </div>
        )}
      </div>
      {isScheduler && (
        <div className="activity-actions">
          <button className="icon-button" onClick={() => onEdit(activity)} aria-label="Edit">
            Edit
          </button>
          <button
            className="icon-button danger"
            onClick={() => onDelete(activity)}
            aria-label="Delete"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
