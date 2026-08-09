/**
 * Web-facing re-export of the shared TfL client.
 * Keep this file so existing `./api/tfl` imports stay stable.
 */
export {
  findNearbyStations,
  getWalkingRoute,
  getWalkingRoutes,
  metresToMiles,
  MAX_ROUTES,
  SEARCH_RADIUS_METRES,
} from '../../shared/tfl'
