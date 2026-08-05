import { Circle, Polygon } from 'react-leaflet'
import type { StationCatchment } from '../types'

interface CatchmentLayerProps {
  catchments: StationCatchment[]
  visible: boolean
}

const FILL = '#1d70b8'
const FILL_OPACITY = 0.12
const STROKE_OPACITY = 0.25

/**
 * Renders station catchments. Supports circles today; polygons (e.g. isochrones)
 * can be produced by a different builder without changing this component.
 */
export default function CatchmentLayer({
  catchments,
  visible,
}: CatchmentLayerProps) {
  if (!visible) return null

  return (
    <>
      {catchments.map((catchment) => {
        const { geometry } = catchment
        if (geometry.kind === 'circle') {
          return (
            <Circle
              key={catchment.stationId}
              center={[geometry.center.lat, geometry.center.lon]}
              radius={geometry.radiusMetres}
              pathOptions={{
                color: FILL,
                weight: 1,
                opacity: STROKE_OPACITY,
                fillColor: FILL,
                fillOpacity: FILL_OPACITY,
                interactive: false,
              }}
            />
          )
        }

        // Future: isochrones / custom polygons
        return (
          <Polygon
            key={catchment.stationId}
            positions={geometry.rings}
            pathOptions={{
              color: FILL,
              weight: 1,
              opacity: STROKE_OPACITY,
              fillColor: FILL,
              fillOpacity: FILL_OPACITY,
              interactive: false,
            }}
          />
        )
      })}
    </>
  )
}
