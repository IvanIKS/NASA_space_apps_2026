from numpy import sqrt

_LANDSCAPE_MAP = []

_MOON_RADIUS_KM = 1737.4

def load_map():
    pass

"""This function returns the maximum distance to a landscape point that the sun could be obstructed by
base on the altitude of observer and possible height of the landscape objects that could rise from
beyond the horizon."""
def _get_max_distance_to_obstructing_landscape_point(alt_km: float) -> float:
    horizon_distance = sqrt(alt_km * ((2 * _MOON_RADIUS_KM) + alt_km))
    # A distance beyond the horizon where high mountains and crater walls could still be visible because of how high they are.
    # TODO : Calculate it somehow.
    distance_beyond_horizon = 0
    return horizon_distance + distance_beyond_horizon


"""
When a sun is above the horizon, the sun's obstruction coefficient is 1.
When a sun is below the horizon, the sun's obstruction coefficient is 0.
Horizon could be different depending on landscape: there could be mountains,
crater walls, etc. 
If sun is setting just above the horizon we try to calculate which part of it is obstructed.
EARTH OBSTRUCTION COEFFICIENT IS NOT IMPLEMENTED YET AND IS OUT OF SCOPE OF THIS COMMIT.
"""
def get_obstruction_coefficient(lat, lon, azimuth, elevation, observer_alt_km=0) -> float:
    distance_on_map = _get_max_distance_to_obstructing_landscape_point(observer_alt_km)
    # 1. Get all points on map that are within distance_on_map from observer in the direction of sun azimuth.
    # 2. Get all points that have higher alt than observer_alt_km.
    # 3. For each point higher alt than observer_alt_km:
    #    3.1. point.alt is cathetus, distance to point is cathetus.
    #    Sun elevation angle where sun stops being visible is atan(point.alt/distance to point) - sun size on the sky. Denote it as min_visibility_angle.
    #    angles_above_min = min_visibility_angle - sun_size_on_the_sky.
    #    max_obs_coefficient = angles_above_min / (sun_size) or previous max_obs_coefficient if it's larger.
    #    If coefficient is <0, set in to 0. If coefficient is >1, set it to 1.
    #    If at any point min_coefficient is <0, return 0.
    #4. return coefficient -- we should return the maximum coefficient.
    return 1