import React from 'react';
import Sidebar from './Sidebar';
import Topnav from './Topnav';

const Layout = ({ children }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topnav />
        <main className="flex-1 overflow-y-auto bg-bgMain">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
