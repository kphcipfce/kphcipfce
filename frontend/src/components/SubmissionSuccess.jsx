import { FiArrowLeft } from "react-icons/fi";
import "./SubmissionSuccess.css";

export default function SubmissionSuccess({ onReturn = () => {} }) {
  return (
    <div className="submission-success">
      <div className="submission-success-icon">
        <svg width="96" height="96" viewBox="0 0 80 80" fill="none">
          <circle className="success-circle" cx="40" cy="40" r="36" stroke="#22c55e" strokeWidth="4" />
          <path className="success-check" d="M24 41L35 52L57 29" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <p className="submission-success-message">Activity submitted</p>

      <button className="submission-success-return" onClick={onReturn}>
        <FiArrowLeft size={16} />
        Return to submitting other activity
      </button>
    </div>
  );
}
