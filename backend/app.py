from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


app = FastAPI(title="Mesto API")


# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# AUTH
# =========================

SECRET_KEY = "mesto-super-secret-key-change-later"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password must be 72 bytes or shorter",
        )

    hashed = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(),
    )

    return hashed.decode("utf-8")


def verify_password(
    password: str,
    hashed_password: str,
) -> bool:
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        return False

    try:
        return bcrypt.checkpw(
            password_bytes,
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        return False


def create_access_token(user_id: int):
    expire = datetime.utcnow() + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expire,
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token",
            )

        return int(user_id)

    except (JWTError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )


# =========================
# DATABASE
# =========================

DATABASE_URL = (
    "postgresql://mesto:mesto_password"
    "@host.docker.internal:5432/mesto"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)


class PlaceDB(Base):
    __tablename__ = "places"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    location = Column(String)
    price_per_night = Column(Integer)
    description = Column(String)


class BookingDB(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    place_id = Column(Integer)
    guest_name = Column(String)
    check_in = Column(String)
    check_out = Column(String)


Base.metadata.create_all(bind=engine)


# =========================
# SCHEMAS
# =========================

class User(BaseModel):
    name: str
    email: str
    password: str


class LoginData(BaseModel):
    email: str
    password: str


class Place(BaseModel):
    name: str
    location: str
    price_per_night: int
    description: str


class Booking(BaseModel):
    place_id: int
    guest_name: str
    check_in: str
    check_out: str


# =========================
# HEALTH
# =========================

@app.get("/users/me")
def get_me(user_id: int = Depends(get_current_user)):
    db = SessionLocal()

    try:
        user = db.query(UserDB).filter(UserDB.id == user_id).first()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        }
    finally:
        db.close()


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


# =========================
# USERS
# =========================

@app.post("/users")
def create_user(user: User):
    db = SessionLocal()

    existing_user = (
        db.query(UserDB)
        .filter(UserDB.email == user.email)
        .first()
    )

    if existing_user:
        db.close()

        return {
            "error": "User already exists"
        }

    new_user = UserDB(
        name=user.name,
        email=user.email,
        password=hash_password(user.password),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    result = {
        "id": new_user.id,
        "name": new_user.name,
        "email": new_user.email,
    }

    db.close()

    return result


@app.get("/users")
def get_users():
    db = SessionLocal()

    users = db.query(UserDB).all()

    result = [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        }
        for user in users
    ]

    db.close()

    return result


# =========================
# LOGIN
# =========================

@app.post("/login")
def login(data: LoginData):
    db = SessionLocal()

    user = (
        db.query(UserDB)
        .filter(UserDB.email == data.email)
        .first()
    )

    if user is None:
        db.close()

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not verify_password(
        data.password,
        user.password,
    ):
        db.close()

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    token = create_access_token(user.id)

    db.close()

    return {
        "access_token": token,
        "token_type": "bearer",
    }


# =========================
# CURRENT USER
# =========================

@app.get("/me")
def get_me(
    user_id: int = Depends(get_current_user),
):
    db = SessionLocal()

    user = (
        db.query(UserDB)
        .filter(UserDB.id == user_id)
        .first()
    )

    db.close()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
    }


# =========================
# PLACES
# =========================

@app.get("/places")
def get_places(
    location: str | None = None,
    max_price: int | None = None,
):
    db = SessionLocal()

    query = db.query(PlaceDB)

    if location:
        query = query.filter(
            PlaceDB.location.ilike(f"%{location}%")
        )

    if max_price:
        query = query.filter(
            PlaceDB.price_per_night <= max_price
        )

    places = query.all()

    result = [
        {
            "id": place.id,
            "name": place.name,
            "location": place.location,
            "price_per_night": place.price_per_night,
            "description": place.description,
        }
        for place in places
    ]

    db.close()

    return result


@app.get("/places/{place_id}")
def get_place(place_id: int):
    db = SessionLocal()

    place = (
        db.query(PlaceDB)
        .filter(PlaceDB.id == place_id)
        .first()
    )

    db.close()

    if place is None:
        raise HTTPException(
            status_code=404,
            detail="Place not found",
        )

    return {
        "id": place.id,
        "name": place.name,
        "location": place.location,
        "price_per_night": place.price_per_night,
        "description": place.description,
    }


@app.post("/places")
def create_place(place: Place):
    db = SessionLocal()

    new_place = PlaceDB(
        name=place.name,
        location=place.location,
        price_per_night=place.price_per_night,
        description=place.description,
    )

    db.add(new_place)
    db.commit()
    db.refresh(new_place)

    result = {
        "id": new_place.id,
        "name": new_place.name,
        "location": new_place.location,
        "price_per_night": new_place.price_per_night,
        "description": new_place.description,
    }

    db.close()

    return result


# =========================
# BOOKINGS
# =========================

@app.post("/bookings")
def create_booking(
    booking: Booking,
    user_id: int = Depends(get_current_user),
):
    db = SessionLocal()

    place = (
        db.query(PlaceDB)
        .filter(PlaceDB.id == booking.place_id)
        .first()
    )

    if place is None:
        db.close()

        raise HTTPException(
            status_code=404,
            detail="Place not found",
        )

    try:
        new_check_in = datetime.strptime(
            booking.check_in,
            "%Y-%m-%d",
        )

        new_check_out = datetime.strptime(
            booking.check_out,
            "%Y-%m-%d",
        )

    except ValueError:
        db.close()

        raise HTTPException(
            status_code=400,
            detail="Dates must be in YYYY-MM-DD format",
        )

    if new_check_in >= new_check_out:
        db.close()

        raise HTTPException(
            status_code=400,
            detail="Check-out must be after check-in",
        )

    existing_bookings = (
        db.query(BookingDB)
        .filter(
            BookingDB.place_id == booking.place_id
        )
        .all()
    )

    for existing in existing_bookings:
        existing_check_in = datetime.strptime(
            existing.check_in,
            "%Y-%m-%d",
        )

        existing_check_out = datetime.strptime(
            existing.check_out,
            "%Y-%m-%d",
        )

        if (
            new_check_in < existing_check_out
            and new_check_out > existing_check_in
        ):
            db.close()

            raise HTTPException(
                status_code=409,
                detail="Place is already booked for these dates",
            )

    new_booking = BookingDB(
        user_id=user_id,
        place_id=booking.place_id,
        guest_name=booking.guest_name,
        check_in=booking.check_in,
        check_out=booking.check_out,
    )

    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)

    result = {
        "id": new_booking.id,
        "user_id": new_booking.user_id,
        "place_id": new_booking.place_id,
        "guest_name": new_booking.guest_name,
        "check_in": new_booking.check_in,
        "check_out": new_booking.check_out,
    }

    db.close()

    return result


@app.get("/bookings")
def get_bookings(
    user_id: int = Depends(get_current_user),
):
    db = SessionLocal()

    bookings = (
        db.query(BookingDB)
        .filter(BookingDB.user_id == user_id)
        .all()
    )

    result = [
        {
            "id": booking.id,
            "place_id": booking.place_id,
            "user_id": booking.user_id,
            "guest_name": booking.guest_name,
            "check_in": booking.check_in,
            "check_out": booking.check_out,
        }
        for booking in bookings
    ]

    db.close()

    return result