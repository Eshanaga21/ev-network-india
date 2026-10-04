from math import atan2, cos, radians, sin, sqrt


def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance in kilometres."""
    dlat, dlon = radians(lat2-lat1), radians(lon2-lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return 6371.0088 * 2 * atan2(sqrt(a), sqrt(1-a))
