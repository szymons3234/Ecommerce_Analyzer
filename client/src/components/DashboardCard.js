import React from 'react';

const DashboardCard = ({ title, children, className }) => {
  return (
    <div className={`card ${className || ''}`}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
};

export default DashboardCard;
