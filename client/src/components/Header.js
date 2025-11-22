import React from 'react';

const Header = ({ dateRange }) => {
  return (
    <header className="main-header">
      <h1>Panel główny</h1>
      <div className="date-range-picker">
        {dateRange}
      </div>
    </header>
  );
};

export default Header;
