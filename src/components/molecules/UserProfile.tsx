"use client";

import { FC, ReactNode } from "react";
import { Card } from "../atoms";
import { UserInfo } from "@/types/auth";

interface UserProfileProps {
  user: UserInfo;
}

export const UserProfile: FC<UserProfileProps> = ({ user }) => {
  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">User Profile</h2>
      <div className="space-y-3">
        {Object.entries(user).map(([key, value], i) => (
          <div
            key={`${i}${key}`}
            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
          >
            <span className="text-sm font-medium text-slate-600">{key}</span>
            <div className="text-sm text-slate-900">
              {dataMapper(value) || "N/A"}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const dataMapper = (data: any): ReactNode => {
  if (typeof data === "string") return <div>{data}</div>;
  if (typeof data === "number") return <div>{data.toString()}</div>;
  if (typeof data === "boolean") return <div>{data ? "True" : "False"}</div>;
  if (data === null || data === undefined) return "null";
  if (typeof data === "object")
    return (
      <pre>
        <code className="prose">{JSON.stringify(data, null, 2)}</code>;
      </pre>
    );
  return (
    <pre>
      <code className="prose">{JSON.stringify(data, null, 2)}</code>;
    </pre>
  );
};
