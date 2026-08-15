import { useEffect, useState } from "react";
import api from "../api/client";
import Spinner from "../components/Spinner";

export default function MyTeam() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/members/my-team").then((res) => setData(res.data));
  }, []);

  if (!data)
    return (
      <div className="page">
        <Spinner />
      </div>
    );

  return (
    <div className="page">
      <h1>My Team</h1>
      {!data.team ? (
        <p>You are not yet assigned to a team. Contact your Super Admin.</p>
      ) : (
        <div className="card">
          <p>
            <strong>Team:</strong> {data.team.name}
          </p>
          {data.teammate ? (
            <>
              <p>
                <strong>Teammate:</strong> {data.teammate.name}
              </p>
              {data.teammate.email && <p>Email: {data.teammate.email}</p>}
              {data.teammate.phone && <p>Phone: {data.teammate.phone}</p>}
            </>
          ) : (
            <p>No teammate assigned yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
