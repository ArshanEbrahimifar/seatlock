import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const holdSuccess = new Counter('hold_success');
const holdConflict = new Counter('hold_conflict');
const holdUnexpected = new Counter('hold_unexpected');

export const options = {
  scenarios: {
    concurrent_hold: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      maxDuration: '30s',
    },
  },

  thresholds: {
    hold_success: ['count==1'],
    hold_conflict: ['count==99'],
    hold_unexpected: ['count==0'],
  },
};

const BASE_URL = 'http://localhost:3000';

export function setup() {
  const suffix = Date.now();

  const venueResponse = http.post(
    `${BASE_URL}/venues`,
    JSON.stringify({
      name: `k6 Venue ${suffix}`,
      city: 'Istanbul',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const venue = venueResponse.json();

  const seatResponse = http.post(
    `${BASE_URL}/venues/${venue.id}/seats`,
    JSON.stringify({
      section: 'VIP',
      row: 'A',
      number: 1,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const seat = seatResponse.json();

  const eventResponse = http.post(
    `${BASE_URL}/venues/${venue.id}/events`,
    JSON.stringify({
      name: `k6 Event ${suffix}`,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const event = eventResponse.json();

  const eventSeatResponse = http.post(
    `${BASE_URL}/events/${event.id}/seats`,
    JSON.stringify({
      seatId: seat.id,
      price: 100,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const eventSeat = eventSeatResponse.json();

  return {
    eventSeatId: eventSeat.id,
  };
}

export default function (data) {
  const response = http.post(
    `${BASE_URL}/event-seats/${data.eventSeatId}/hold`,
    null,
  );

  if (response.status === 200 || response.status === 201) {
    holdSuccess.add(1);
  } else if (response.status === 409) {
    holdConflict.add(1);
  } else {
    holdUnexpected.add(1);
  }

  check(response, {
    'hold is success or conflict': (res) =>
      res.status === 200 || res.status === 201 || res.status === 409,
  });
}
