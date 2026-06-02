export default function Logo({ size = 40, className = '' }) {
    return (
        <img
            src="/images/logo.png"
            alt="روائس"
            width={size}
            height={size}
            className={`object-contain ${className}`}
            onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
            }}
        />
    );
}
