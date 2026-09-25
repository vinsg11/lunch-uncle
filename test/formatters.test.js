import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatForecast,
  formatBusArrivals,
  formatPlaces,
  resolveOrigin,
  CT_HUB_2,
  haversineMetres,
} from "../src/tools.js";

test("formatForecast picks the requested area", () => {
  const payload = {
    data: {
      items: [
        {
          valid_period: { text: "12 pm to 2 pm" },
          forecasts: [
            { area: "Geylang", forecast: "Fair" },
            { area: "Kallang", forecast: "Light Rain" },
          ],
        },
      ],
    },
  };

  assert.deepEqual(formatForecast(payload, "Kallang"), {
    area: "Kallang",
    forecast: "Light Rain",
    valid_period: "12 pm to 2 pm",
  });
});

test("formatBusArrivals converts durations to whole minutes", () => {
  const payload = {
    services: [
      {
        no: "13",
        next: { duration_ms: 100_798 },
        subsequent: { duration_ms: 1_210_000 },
      },
      { no: "107M", next: { duration_ms: 30_000 }, subsequent: null },
    ],
  };

  assert.deepEqual(formatBusArrivals(payload, "07371"), {
    stop_code: "07371",
    services: [
      { service: "13", next_min: 2, subsequent_min: 20 },
      { service: "107M", next_min: 1, subsequent_min: null },
    ],
  });
});

test("haversineMetres measures CT Hub 2 to Lavender MRT at under 600 m", () => {
  const ctHub2 = { latitude: 1.3115, longitude: 103.8636 };
  const lavenderMrt = { latitude: 1.3073, longitude: 103.8631 };
  const distance = haversineMetres(ctHub2, lavenderMrt);
  assert.ok(distance > 400 && distance < 550, `got ${distance}`);
});

test("formatPlaces drops far places and sorts nearest first", () => {
  const ctHub2 = { latitude: 1.3115, longitude: 103.8636 };
  const places = [
    {
      displayName: { text: "Lavender MRT stall" },
      rating: 4.1,
      location: { latitude: 1.3073, longitude: 103.8631 },
    },
    {
      displayName: { text: "Bedok stall" },
      rating: 4.8,
      location: { latitude: 1.3236, longitude: 103.9273 },
    },
    {
      displayName: { text: "Next door" },
      location: { latitude: 1.3116, longitude: 103.8616 },
    },
  ];

  const result = formatPlaces(places, ctHub2, 800);
  assert.deepEqual(
    result.map((p) => p.name),
    ["Next door", "Lavender MRT stall"],
  );
  assert.equal(result[0].rating, null);
});

test("formatPlaces passes through whether each place is open now", () => {
  const ctHub2 = { latitude: 1.3115, longitude: 103.8636 };
  const here = { latitude: 1.3116, longitude: 103.8616 };
  const places = [
    { displayName: { text: "Open" }, location: here, currentOpeningHours: { openNow: true } },
    { displayName: { text: "Closed" }, location: here, currentOpeningHours: { openNow: false } },
    { displayName: { text: "No hours" }, location: here },
  ];

  assert.deepEqual(
    formatPlaces(places, ctHub2).map((p) => [p.name, p.open_now]),
    [["Open", true], ["Closed", false], ["No hours", null]],
  );
});

test("resolveOrigin uses the browser location when it is a valid coordinate", () => {
  const lavenderMrt = { latitude: 1.3073, longitude: 103.8631 };
  assert.deepEqual(resolveOrigin(lavenderMrt), lavenderMrt);
});

test("resolveOrigin falls back to CT Hub 2 for missing or bad locations", () => {
  for (const location of [
    undefined,
    null,
    {},
    { latitude: "1.3", longitude: "103.8" },
    { latitude: 91, longitude: 103.8 },
    { latitude: 1.3, longitude: NaN },
  ]) {
    assert.equal(resolveOrigin(location), CT_HUB_2, JSON.stringify(location));
  }
});
