import heroImage from './assets/hero.png';
import forestHouseImage from './assets/places/forest-house.jpg';
import mountainCabinImage from './assets/places/mountain-cabin.jpg';
import lakeHouseImage from './assets/places/lake-house.jpg';
import { useEffect, useState } from 'react'
import './App.css'

const API_URL = 'http://localhost:8000'

function App() {
  const [places, setPlaces] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [token, setToken] = useState(
    localStorage.getItem('mesto_token') || ''
  )

  const [user, setUser] = useState(null)

  const [authMode, setAuthMode] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
  })

  const [bookingForm, setBookingForm] = useState({
    guest_name: '',
    check_in: '',
    check_out: '',
  })

  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingMessage, setBookingMessage] = useState('')
  const [bookingError, setBookingError] = useState('')

  const [myBookings, setMyBookings] = useState([])
  const [showBookings, setShowBookings] = useState(false)
  const [bookingsLoading, setBookingsLoading] = useState(false)

  // =========================
  // LOAD PLACES
  // =========================

  useEffect(() => {
    fetch(`${API_URL}/places`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load places')
        }

        return response.json()
      })
      .then((data) => {
        setPlaces(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not connect to Mesto API')
        setLoading(false)
      })
  }, [])

  // =========================
  // LOAD CURRENT USER
  // =========================

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }

    fetch(`${API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Invalid token')
        }

        return response.json()
      })
      .then((data) => {
        setUser(data)
        setAuthForm((previous) => ({
          ...previous,
          name: data.name,
        }))
      })
      .catch(() => {
        localStorage.removeItem('mesto_token')
        setToken('')
        setUser(null)
      })
  }, [token])

  // =========================
  // OPEN PLACE
  // =========================

  const openPlace = (place) => {
    setSelectedPlace(place)

    setBookingForm({
      guest_name: user?.name || '',
      check_in: '',
      check_out: '',
    })

    setBookingMessage('')
    setBookingError('')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const closePlace = () => {
    setSelectedPlace(null)
    setBookingMessage('')
    setBookingError('')
  }

  // =========================
  // AUTH
  // =========================

  const openAuth = (mode) => {
    setAuthMode(mode)
    setAuthError('')

    setAuthForm({
      name: user?.name || '',
      email: '',
      password: '',
    })
  }

  const closeAuth = () => {
    setAuthMode(null)
    setAuthError('')
  }

  const handleAuthChange = (event) => {
    const { name, value } = event.target

    setAuthForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()

    setAuthLoading(true)
    setAuthError('')

    try {
      if (authMode === 'register') {
        const response = await fetch(`${API_URL}/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: authForm.name,
            email: authForm.email,
            password: authForm.password,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.detail || 'Registration failed'
          )
        }

        if (data.error) {
          throw new Error(data.error)
        }

        // После регистрации сразу переключаемся на login
        setAuthMode('login')

        setAuthForm({
          name: '',
          email: authForm.email,
          password: '',
        })

        setAuthError('')
        return
      }

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail || 'Login failed'
        )
      }

      localStorage.setItem(
        'mesto_token',
        data.access_token
      )

      setToken(data.access_token)

      const meResponse = await fetch(`${API_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
        },
      })

      if (meResponse.ok) {
        const meData = await meResponse.json()
        setUser(meData)
      } else {
        setUser({
          email: authForm.email,
          name: authForm.email.split('@')[0],
        })
      }

      setAuthMode(null)
      setAuthError('')
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  // =========================
  // LOGOUT
  // =========================

  const logout = () => {
    localStorage.removeItem('mesto_token')
    setToken('')
    setUser(null)
    setMyBookings([])
    setShowBookings(false)
    setSelectedPlace(null)
  }

  // =========================
  // BOOKING
  // =========================

  const handleBookingChange = (event) => {
    const { name, value } = event.target

    setBookingForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleBooking = async (event) => {
    event.preventDefault()
    console.log('BOOKING CLICKED', {
      token: Boolean(token),
      user,
      selectedPlace,
      bookingForm,
    })

    if (!token) {
      openAuth('login')
      return
    }

    setBookingLoading(true)
    setBookingMessage('')
    setBookingError('')

    try {
      const response = await fetch(
        `${API_URL}/bookings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            place_id: selectedPlace.id,
            guest_name: bookingForm.guest_name,
            check_in: bookingForm.check_in,
            check_out: bookingForm.check_out,
          }),
        }
      )

      const data = await response.json()

      console.log('BOOKING RESPONSE', {
        status: response.status,
        ok: response.ok,
        data,
      })

      if (response.status === 401) {
        logout()
        throw new Error(
          'Your session expired. Please log in again.'
        )
      }

      if (response.status === 409) {
        throw new Error(
          'This place is already booked for these dates.'
        )
      }

      if (!response.ok) {
        throw new Error(
          data.detail || 'Booking failed'
        )
      }

      setBookingMessage(
        'Booking confirmed! Your stay is reserved.'
      )

      setBookingForm({
        guest_name: user?.name || '',
        check_in: '',
        check_out: '',
      })
    } catch (error) {
      setBookingError(error.message)
    } finally {
      setBookingLoading(false)
    }
  }

  // =========================
  // MY BOOKINGS
  // =========================

  const loadBookings = async () => {
    if (!token) {
      openAuth('login')
      return
    }

    setBookingsLoading(true)

    try {
      const response = await fetch(
        `${API_URL}/bookings`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.status === 401) {
        logout()
        return
      }

      const data = await response.json()

      setMyBookings(data)
      setShowBookings(true)
    } catch {
      setMyBookings([])
    } finally {
      setBookingsLoading(false)
    }
  }

  // =========================
  // FIND PLACE BY ID
  // =========================

  const getPlaceById = (placeId) => {
    return places.find(
      (place) => place.id === placeId
    )
  }

  // =========================
  // PLACE DETAILS
  // =========================

  if (selectedPlace) {
    return (
      <div className="app">
        <header className="header">
          <button
            className="logo logo-button"
            onClick={closePlace}
          >
            mesto
          </button>

          <nav className="nav">
            {user ? (
              <>
                <button
                  className="nav-user"
                  onClick={loadBookings}
                >
                  {user.name}
                </button>

                <button
                  className="login-button"
                  onClick={logout}
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                className="login-button"
                onClick={() => openAuth('login')}
              >
                Log in
              </button>
            )}
          </nav>
        </header>

        <main>
          <section className="place-details">
            <div className="place-details-image" style={{
            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.5)), url(${
              selectedPlace?.name === 'Forest House'
                ? forestHouseImage
                : selectedPlace?.name === 'Mountain Cabin'
                ? mountainCabinImage
                : lakeHouseImage
            })`
          }}>
              <span>{selectedPlace.location}</span>
            </div>

            <div className="place-details-content">
              <button
                className="back-button"
                onClick={closePlace}
              >
                ← Back to places
              </button>

              <p className="eyebrow">
                YOUR NEXT ESCAPE
              </p>

              <h1>{selectedPlace.name}</h1>

              <p className="place-location">
                📍 {selectedPlace.location}
              </p>

              <p className="place-description">
                {selectedPlace.description}
              </p>

              <div className="place-details-price">
                <span>Price per night</span>

                <strong>
                  ₽
                  {selectedPlace.price_per_night.toLocaleString(
                    'ru-RU'
                  )}
                </strong>
              </div>

              <div className="booking-box">
                <h2>Book this place</h2>

                {!user && (
                  <p className="booking-login-text">
                    Log in or create an account to book
                    this place.
                  </p>
                )}

                <form onSubmit={handleBooking}>
                  <label>
                    Guest name
                    <input
                      type="text"
                      name="guest_name"
                      value={bookingForm.guest_name}
                      onChange={handleBookingChange}
                      placeholder="Your name"
                      required
                    />
                  </label>

                  <div className="date-grid">
                    <label>
                      Check-in
                      <input
                        type="date"
                        name="check_in"
                        value={bookingForm.check_in}
                        onChange={handleBookingChange}
                        required
                      />
                    </label>

                    <label>
                      Check-out
                      <input
                        type="date"
                        name="check_out"
                        value={bookingForm.check_out}
                        onChange={handleBookingChange}
                        required
                      />
                    </label>
                  </div>

                  {bookingError && (
                    <div className="message error-message">
                      {bookingError}
                    </div>
                  )}

                  {bookingMessage && (
                    <div className="message success-message">
                      {bookingMessage}
                    </div>
                  )}

                  <button
                    className="primary-button booking-submit"
                    type="submit"
                    disabled={bookingLoading}
                  >
                    {bookingLoading
                      ? 'Booking...'
                      : user
                        ? 'Confirm booking'
                        : 'Log in to book'}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="logo">mesto</div>
          <p>© 2026 Mesto Booking</p>
        </footer>

        {authMode && (
          <AuthModal
            mode={authMode}
            form={authForm}
            loading={authLoading}
            error={authError}
            onChange={handleAuthChange}
            onSubmit={handleAuthSubmit}
            onClose={closeAuth}
            onSwitch={() =>
              setAuthMode(
                authMode === 'login'
                  ? 'register'
                  : 'login'
              )
            }
          />
        )}
      </div>
    )
  }

  // =========================
  // MAIN PAGE
  // =========================

  return (
    <div className="app">
      <header className="header">
        <button
          className="logo logo-button"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: 'smooth',
            })
          }
        >
          mesto
        </button>

        <nav className="nav">
          <a href="#places">Places</a>
          <a href="#about">About</a>

          {user ? (
            <>
              <button
                className="nav-user"
                onClick={loadBookings}
              >
                {user.name}
              </button>

              <button
                className="login-button"
                onClick={logout}
              >
                Log out
              </button>
            </>
          ) : (
            <button
              className="login-button"
              onClick={() => openAuth('login')}
            >
              Log in
            </button>
          )}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">
              YOUR NEXT ESCAPE
            </p>

            <h1>
              Find a place
              <br />
              worth staying.
            </h1>

            <p className="hero-text">
              Discover unique places to stay and book
              your next escape in a few clicks.
            </p>

            <button
              className="primary-button"
              onClick={() =>
                document
                  .getElementById('places')
                  .scrollIntoView({
                    behavior: 'smooth',
                  })
              }
            >
              Explore places
            </button>
          </div>
        </section>

        <section
          className="places-section"
          id="places"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">DISCOVER</p>
              <h2>Popular places</h2>
            </div>

            <p className="section-description">
              Hand-picked places for your next adventure.
            </p>
          </div>

          {loading && (
            <p className="status-text">
              Loading places...
            </p>
          )}

          {error && (
            <p className="status-text error-text">
              {error}
            </p>
          )}

          {!loading &&
            !error &&
            places.length === 0 && (
              <p className="status-text">
                No places available yet.
              </p>
            )}

          <div className="places-grid">
            {places.map((place) => (
              <article
                className="place-card"
                key={place.id}
              >
                <div className="place-image" style={{
            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.5)), url(${
              place.name === 'Forest House'
                ? forestHouseImage
                : place.name === 'Mountain Cabin'
                ? mountainCabinImage
                : lakeHouseImage
            })`
          }}>
                  <span>{place.location}</span>
                </div>

                <div className="place-content">
                  <div className="place-top">
                    <h3>{place.name}</h3>

                    <span className="price">
                      ₽
                      {place.price_per_night.toLocaleString(
                        'ru-RU'
                      )}
                    </span>
                  </div>

                  <p>{place.description}</p>

                  <button
                    className="book-button"
                    onClick={() => openPlace(place)}
                  >
                    View place
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="about-section"
          id="about"
        >
          <p className="eyebrow">MESTO</p>

          <h2>Stay somewhere memorable.</h2>

          <p>
            Mesto makes it simple to discover beautiful
            places, check availability and book your stay.
          </p>
        </section>
      </main>

      <footer className="footer">
        <div className="logo">mesto</div>
        <p>© 2026 Mesto Booking</p>
      </footer>

      {showBookings && (
        <BookingsModal
          bookings={myBookings}
          places={places}
          loading={bookingsLoading}
          onClose={() => setShowBookings(false)}
        />
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          form={authForm}
          loading={authLoading}
          error={authError}
          onChange={handleAuthChange}
          onSubmit={handleAuthSubmit}
          onClose={closeAuth}
          onSwitch={() =>
            setAuthMode(
              authMode === 'login'
                ? 'register'
                : 'login'
            )
          }
        />
      )}
    </div>
  )
}

// =========================
// AUTH MODAL
// =========================

function AuthModal({
  mode,
  form,
  loading,
  error,
  onChange,
  onSubmit,
  onClose,
  onSwitch,
}) {
  const isLogin = mode === 'login'

  return (
    <div className="modal-overlay">
      <div className="auth-modal">
        <button
          className="modal-close"
          onClick={onClose}
        >
          ×
        </button>

        <p className="eyebrow">
          MESTO ACCOUNT
        </p>

        <h2>
          {isLogin
            ? 'Welcome back.'
            : 'Create your account.'}
        </h2>

        <p className="modal-description">
          {isLogin
            ? 'Log in to manage your bookings.'
            : 'Create an account to book your stay.'}
        </p>

        <form onSubmit={onSubmit}>
          {!isLogin && (
            <label>
              Name
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={onChange}
                placeholder="Vladimir"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              placeholder="••••••••"
              required
            />
          </label>

          {error && (
            <div className="message error-message">
              {error}
            </div>
          )}

          <button
            className="primary-button full-width"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : isLogin
                ? 'Log in'
                : 'Create account'}
          </button>
        </form>

        <button
          className="switch-auth"
          onClick={onSwitch}
        >
          {isLogin
            ? 'Need an account? Create one'
            : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}

// =========================
// BOOKINGS MODAL
// =========================

function BookingsModal({
  bookings,
  places,
  loading,
  onClose,
}) {
  return (
    <div className="modal-overlay">
      <div className="bookings-modal">
        <button
          className="modal-close"
          onClick={onClose}
        >
          ×
        </button>

        <p className="eyebrow">YOUR ACCOUNT</p>

        <h2>My bookings</h2>

        {loading && (
          <p className="status-text">
            Loading bookings...
          </p>
        )}

        {!loading && bookings.length === 0 && (
          <div className="empty-bookings">
            <p>You don't have any bookings yet.</p>
            <span>
              Explore our places and book your next
              escape.
            </span>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div className="booking-list">
            {bookings.map((booking) => {
              const place = places.find(
                (item) =>
                  item.id === booking.place_id
              )

              return (
                <div
                  className="booking-item"
                  key={booking.id}
                >
                  <div>
                    <span className="booking-number">
                      BOOKING #{booking.id}
                    </span>

                    <h3>
                      {place
                        ? place.name
                        : `Place #${booking.place_id}`}
                    </h3>

                    <p>
                      {place?.location ||
                        'Location unavailable'}
                    </p>
                  </div>

                  <div className="booking-dates">
                    <span>
                      {booking.check_in}
                    </span>

                    <strong>→</strong>

                    <span>
                      {booking.check_out}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
