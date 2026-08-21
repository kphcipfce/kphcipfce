import Facility from "../models/Facility.js";
import Team from "../models/Team.js";

// A member only ever picks from their own team's district; a district_viewer (coordinator)
// or grm_focal (GRM focal person) only their own district — same rule as activity submission
// deriving district from the team, so a district query param can't be used to browse another
// district's facility list. super_admin can pass ?district= to inspect any district.
export async function listFacilities(req, res) {
  const filter = {};
  if (req.user.role === "member") {
    const team = await Team.findById(req.user.team);
    filter.district = team?.district || null;
  } else if (req.user.role === "district_viewer" || req.user.role === "grm_focal") {
    filter.district = req.user.district;
  } else if (req.query.district) {
    filter.district = req.query.district;
  }
  const facilities = await Facility.find(filter).populate("district", "name").sort("name");
  res.json(facilities);
}
