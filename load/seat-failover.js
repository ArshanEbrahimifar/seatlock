import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';

const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || '60s';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const upstreamFailureRate = new Rate('upstream_failure_rate');

const businessFailureRate = new Rate('business_failure_rate');

const unexpectedRate = new Rate('unexpected_rate');

const upstreamFailures = new Counter('upstream_failures');

const businessFailures = new Counter('business_failures');

const holdSuccesses = new Counter('hold_successes');

const releaseSuccesses = new Counter('release_successes');

const holdDuration = new Trend('hold_duration');

const releaseDuration = new Trend('release_duration');

export const options = {
  vus: VUS,
  duration: DURATION,

  thresholds: {
    unexpected_rate: ['rate<0.01'],
  },
};

const headers = {
  'Content-Type': 'application/json',
};

function isUpstreamFailure(response) {
  return (
    response.status === 0 ||
    response.status === 502 ||
    response.status === 503 ||
    response.status === 504
  );
}

export function setup() {
  const suffix = Date.now();

  const venueResponse = http.post(
    `${BASE_URL}/venues`,
    JSON.stringify({
      name: `Failover Venue ${suffix}`,
      city: 'Istanbul',
    }),
    {
      headers,
    },
  );

  if (venueResponse.status !== 201) {
    throw new Error(`Venue creation failed: ${venueResponse.status}`);
  }

  const venue = venueResponse.json();

  const eventResponse = http.post(
    `${BASE_URL}/venues/${venue.id}/events`,
    JSON.stringify({
      name: `Failover Event ${suffix}`,

      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
    {
      headers,
    },
  );

  if (eventResponse.status !== 201) {
    throw new Error(`Event creation failed: ${eventResponse.status}`);
  }

  const event = eventResponse.json();

  const eventSeatIds = [];

  const seatsPerVu = 10;

  const totalSeats = VUS * seatsPerVu;

  for (let i = 1; i <= totalSeats; i += 1) {
    const seatResponse = http.post(
      `${BASE_URL}/venues/${venue.id}/seats`,
      JSON.stringify({
        section: `FAILOVER-${suffix}`,

        row: 'A',

        number: i,
      }),
      {
        headers,
      },
    );

    if (seatResponse.status !== 201) {
      throw new Error(`Seat ${i} creation failed: ${seatResponse.status}`);
    }

    const seat = seatResponse.json();

    const eventSeatResponse = http.post(
      `${BASE_URL}/events/${event.id}/seats`,
      JSON.stringify({
        seatId: seat.id,
        price: 100,
      }),
      {
        headers,
      },
    );

    if (eventSeatResponse.status !== 201) {
      throw new Error(
        `EventSeat ${i} creation failed: ${eventSeatResponse.status}`,
      );
    }

    eventSeatIds.push(eventSeatResponse.json().id);
  }

  return {
    eventSeatIds,
    seatsPerVu,
  };
}

export default function (data) {
  const vuIndex = exec.vu.idInTest - 1;

  const iterationIndex = exec.vu.iterationInInstance;

  const seatOffset = iterationIndex % data.seatsPerVu;

  const index = vuIndex * data.seatsPerVu + seatOffset;

  const eventSeatId = data.eventSeatIds[index];

  const holdResponse = http.post(
    `${BASE_URL}/event-seats/${eventSeatId}/hold`,
    null,
    {
      timeout: '3s',
    },
  );

  holdDuration.add(holdResponse.timings.duration);

  const holdOk = holdResponse.status === 200 || holdResponse.status === 201;

  if (!holdOk) {
    if (isUpstreamFailure(holdResponse)) {
      upstreamFailures.add(1);
      upstreamFailureRate.add(true);

      businessFailureRate.add(false);
      unexpectedRate.add(false);

      sleep(0.1);

      return;
    }

    if (holdResponse.status === 409) {
      businessFailures.add(1);

      businessFailureRate.add(true);
      upstreamFailureRate.add(false);
      unexpectedRate.add(false);

      sleep(0.1);

      return;
    }

    unexpectedRate.add(true);
    upstreamFailureRate.add(false);
    businessFailureRate.add(false);

    sleep(0.1);

    return;
  }

  holdSuccesses.add(1);

  upstreamFailureRate.add(false);
  businessFailureRate.add(false);

  const holdToken = holdResponse.json().holdToken;

  const releaseResponse = http.post(
    `${BASE_URL}/event-seats/${eventSeatId}/release`,
    JSON.stringify({
      holdToken,
    }),
    {
      headers,
      timeout: '3s',
    },
  );

  releaseDuration.add(releaseResponse.timings.duration);

  const releaseOk =
    releaseResponse.status === 200 || releaseResponse.status === 201;

  if (releaseOk) {
    releaseSuccesses.add(1);

    unexpectedRate.add(false);

    check(releaseResponse, {
      'release succeeded': () => true,
    });

    return;
  }

  if (isUpstreamFailure(releaseResponse)) {
    upstreamFailures.add(1);
    upstreamFailureRate.add(true);

    unexpectedRate.add(false);

    sleep(0.1);

    return;
  }

  businessFailures.add(1);
  businessFailureRate.add(true);

  unexpectedRate.add(true);

  sleep(0.1);
}
