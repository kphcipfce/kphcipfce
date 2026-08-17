import { useEffect, useState } from "react";
import { IoPeopleOutline, IoPersonCircleOutline } from "react-icons/io5";
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
        <div className="card team-card">
          <div className="team-card-row">
            <IoPeopleOutline className="team-card-icon" />
            <div>
              <span className="team-card-label">Team</span>
              <p className="team-card-value">{data.team.name}</p>
            </div>
          </div>

          <div className="team-card-row team-card-row-divided">
            <IoPersonCircleOutline className="team-card-icon" />
            {data.teammate ? (
              <div>
                <span className="team-card-label">Teammate</span>
                <p className="team-card-value">{data.teammate.name}</p>
                {data.teammate.email && <p className="team-card-sub">{data.teammate.email}</p>}
                {data.teammate.phone && <p className="team-card-sub">{data.teammate.phone}</p>}
              </div>
            ) : (
              <div>
                <span className="team-card-label">Teammate</span>
                <p className="team-card-sub">No teammate assigned yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
