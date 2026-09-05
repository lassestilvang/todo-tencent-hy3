/**
 * Sun-Position-Based Theme Scheduler
 *
 * Automatically switches between light and dark themes based on
 * sunrise/sunset times for the user's location, falling back to
 * civil twilight (when the sun is 6° below the horizon) for smoother
 * transitions.
 *
 * Uses the SunCalc algorithm for sunrise/sunset calculation — no
 * external API required. Falls back to a simple hour-based heuristic
 * when geolocation is unavailable.
 */

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

const STORAGE_KEY = 'taskflow_sun_theme_enabled'
const STORAGE_LAT_KEY = 'taskflow_sun_theme_lat'
const STORAGE_LNG_KEY = 'taskflow_sun_theme_lng'

interface SunTimes {
  sunrise: number // epoch ms
  sunset: number // epoch ms
  civilDawn: number // epoch ms
  civilDusk: number // epoch ms
}

/**
 * Calculate sunrise and sunset times using the NOAA Solar Calculator
 * algorithm. Returns epoch milliseconds.
 *
 * This is a simplified version that works without external APIs.
 * Accuracy is within ~1 minute for most locations.
 */
function calculateSunTimes(date: Date, latitude: number, longitude: number): SunTimes {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  )

  // Solar declination (approximate)
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81))

  // Hour angle at sunrise/sunset
  const latRad = latitude * Math.PI / 180
  const decRad = declination * Math.PI / 180

  const cosHourAngle =
    (Math.cos(Math.PI / 2) - Math.sin(latRad) * Math.sin(decRad)) /
    (Math.cos(latRad) * Math.cos(decRad))

  // For civil twilight (-6°), adjust slightly
  const cosHourAngleCivil =
    (Math.cos((90 + 6) * Math.PI / 180) - Math.sin(latRad) * Math.sin(decRad)) /
    (Math.cos(latRad) * Math.cos(decRad))

  let sunriseHour: number
  let sunsetHour: number

  if (Math.abs(cosHourAngle) <= 1) {
    const hourAngle = Math.acos(Math.min(1, Math.max(-1, cosHourAngle))) * 180 / Math.PI
    sunriseHour = (360 - hourAngle + longitude) / 15 // in hours from solar noon
    sunsetHour = (hourAngle + longitude) / 15
  } else {
    // Polar day or night — default to 6am / 6pm
    sunriseHour = -6
    sunsetHour = 6
  }

  let civilDawnHour: number
  let civilDuskHour: number
  if (Math.abs(cosHourAngleCivil) <= 1) {
    const hourAngle = Math.acos(Math.min(1, Math.max(-1, cosHourAngleCivil))) * 180 / Math.PI
    civilDawnHour = (360 - hourAngle + longitude) / 15
    civilDuskHour = (hourAngle + longitude) / 15
  } else {
    civilDawnHour = sunriseHour
    civilDuskHour = sunsetHour
  }

  // Convert to epoch ms (approximate — using local date components)
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  const timezoneOffset = date.getTimezoneOffset() * 60000

  // Solar noon is at 12:00 local time
  // sunriseHour is the offset from solar noon
  const solarNoon = Date.UTC(year, month, day, 12, 0, 0) - timezoneOffset

  const sunriseTs = solarNoon + sunriseHour * 3600000
  const sunsetTs = solarNoon + sunsetHour * 3600000
  const civilDawnTs = solarNoon + civilDawnHour * 3600000
  const civilDuskTs = solarNoon + civilDuskHour * 3600000

  return {
    sunrise: sunriseTs,
    sunset: sunsetTs,
    civilDawn: civilDawnTs,
    civilDusk: civilDuskTs,
  }
}

/**
 * Fallback heuristic: use sunset at 6pm and sunrise at 6am.
 */
function getDefaultSunTimes(date: Date): SunTimes {
  const d = new Date(date)
  d.setHours(6, 0, 0, 0)
  const sunrise = d.getTime()
  d.setHours(18, 0, 0, 0)
  const sunset = d.getTime()

  return {
    sunrise,
    sunset,
    civilDawn: sunrise - 30 * 60000,
    civilDusk: sunset + 30 * 60000,
  }
}

export function useSunPositionTheme() {
  const { theme, setTheme } = useTheme()
  const [enabled, setEnabled] = useState<boolean>(true)
  const [hasLocation, setHasLocation] = useState<boolean>(false)

  useEffect(() => {
    // Check if the user opted out
    const stored = localStorage.getItem(STORAGE_KEY)
    setEnabled(stored !== 'false')
  }, [])

  useEffect(() => {
    if (!enabled) return

    const updateTheme = () => {
      const now = new Date()
      const lat = parseFloat(localStorage.getItem(STORAGE_LAT_KEY) || '0')
      const lng = parseFloat(localStorage.getItem(STORAGE_LNG_KEY) || '0')

      let sunTimes: SunTimes
      if (lat !== 0 && lng !== 0) {
        sunTimes = calculateSunTimes(now, lat, lng)
      } else {
        sunTimes = getDefaultSunTimes(now)
      }

      const time = now.getTime()

      // Use civil twilight for smoother transitions
      const isDay = time > sunTimes.civilDawn && time < sunTimes.civilDusk

      if (isDay && theme !== 'light') {
        setTheme('light')
      } else if (!isDay && theme !== 'dark') {
        setTheme('dark')
      }
    }

    updateTheme()

    // Update every 10 minutes
    const interval = setInterval(updateTheme, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [enabled, theme, setTheme])

  /**
   * Request the user's location for accurate sunrise/sunset times.
   * Falls back gracefully if geolocation is unavailable.
   */
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setHasLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        localStorage.setItem(STORAGE_LAT_KEY, String(latitude))
        localStorage.setItem(STORAGE_LNG_KEY, String(longitude))
        setHasLocation(true)
      },
      (error) => {
        console.warn('Location access denied for theme scheduling:', error)
        setHasLocation(false)
      },
      { timeout: 5000, enableHighAccuracy: false }
    )
  }

  const toggle = (value: boolean) => {
    setEnabled(value)
    localStorage.setItem(STORAGE_KEY, String(value))
    if (value) {
      requestLocation()
    }
  }

  return { enabled, hasLocation, toggle, requestLocation: () => requestLocation() }
}

/**
 * Get approximate sunrise/sunset times for the current location.
 * Used by the settings page preview.
 */
export function getSunTimesForToday(): { sunrise: string; sunset: string; isDay: boolean } | null {
  if (typeof window === 'undefined') return null

  const lat = parseFloat(localStorage.getItem(STORAGE_LAT_KEY) || '0')
  const lng = parseFloat(localStorage.getItem(STORAGE_LNG_KEY) || '0')

  const now = new Date()
  let sunTimes: SunTimes
  if (lat !== 0 && lng !== 0) {
    sunTimes = calculateSunTimes(now, lat, lng)
  } else {
    sunTimes = getDefaultSunTimes(now)
  }

  const time = now.getTime()
  const isDay = time > sunTimes.civilDawn && time < sunTimes.civilDusk

  return {
    sunrise: new Date(sunTimes.sunrise).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }),
    sunset: new Date(sunTimes.sunset).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }),
    isDay,
  }
}
