export default function ToastContainer({ toasts }) {
  return (
    <div className="toast-container" id="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span className="toast-icon">{toast.icon}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
