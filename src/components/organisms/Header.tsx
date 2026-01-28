"use client";

import { FC } from "react";
import Link from "next/link";
import { Button } from "../atoms";

interface HeaderProps {
  isAuthenticated: boolean;
  onLogout?: () => void;
}

export const Header: FC<HeaderProps> = ({ isAuthenticated, onLogout }) => {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-blue-600">
          SSO Tenant Example
        </Link>
        <nav className="flex gap-4 items-center">
          <Link href="/" className="text-gray-700 hover:text-blue-600">
            Home
          </Link>
          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className="text-gray-700 hover:text-blue-600"
              >
                Dashboard
              </Link>
              <Button variant="secondary" onClick={onLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/oauth/login"
                className="text-gray-700 hover:text-blue-600"
              >
                OAuth Login
              </Link>
              <Link
                href="/manual/login"
                className="text-gray-700 hover:text-blue-600"
              >
                Manual Login
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
