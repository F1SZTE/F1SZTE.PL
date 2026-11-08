(() => {
  const t = (key, values) => window.FlameGuardI18n.t(key, values);
  const form = document.querySelector('#trip-form');
  const message = document.querySelector('#admin-message');
  const table = document.querySelector('#admin-trips');
  const empty = document.querySelector('#admin-empty');
  const typeSelect = document.querySelector('#admin-travel-type');
  const originSelect = document.querySelector('#admin-origin');
  const destinationSelect = document.querySelector('#admin-destination');
  let csrf = '';
  let currentType = 'flight';

  async function request(action, options = {}) {
    const headers = { 'Accept': 'application/json' };
    if (options.body) {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = csrf;
    }
    const [name, queryString] = action.split('&', 2);
    const params = new URLSearchParams({ action: name });
    if (queryString) new URLSearchParams(queryString).forEach((value, key) => params.set(key, value));
    const response = await fetch(`api.php?${params.toString()}`, { credentials: 'same-origin', ...options, headers: { ...headers, ...(options.headers || {}) } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'server_error');
    if (data.csrf) csrf = data.csrf;
    return data;
  }

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle('error', isError);
  }

  async function loadPlaces() {
    const data = await request(`places&kind=${currentType}`);
    const previousOrigin = originSelect.value;
    const previousDestination = destinationSelect.value;
    originSelect.replaceChildren();
    destinationSelect.replaceChildren();
    data.places.forEach((place) => {
      const option = document.createElement('option');
      option.value = place.code;
      option.textContent = `${place.place_name} (${place.code})`;
      originSelect.append(option);
      destinationSelect.append(option.cloneNode(true));
    });
    if ([...originSelect.options].some((option) => option.value === previousOrigin)) originSelect.value = previousOrigin;
    if ([...destinationSelect.options].some((option) => option.value === previousDestination)) destinationSelect.value = previousDestination;
    const preferredOrigin = currentType === 'flight' ? 'PRG' : 'STC';
    const preferredDestination = currentType === 'flight' ? 'STI' : 'STA';
    if ([...originSelect.options].some((option) => option.value === preferredOrigin)) originSelect.value = preferredOrigin;
    if ([...destinationSelect.options].some((option) => option.value === preferredDestination)) destinationSelect.value = preferredDestination;
    document.querySelector('#admin-operator').value = currentType === 'flight' ? 'FlameGuard Air' : 'FlameGuard Rail';
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat(window.FlameGuardI18n.getLanguage(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Warsaw' }).format(new Date(value.replace(' ', 'T')));
  }

  async function loadTrips() {
    const data = await request('admin-trips');
    table.replaceChildren();
    empty.hidden = data.trips.length > 0;
    data.trips.forEach((trip) => {
      const row = document.createElement('tr');
      const service = document.createElement('td');
      service.textContent = `${trip.travel_type === 'train' ? '🚆' : '✈'} ${trip.origin_code} → ${trip.destination_code} · ${trip.operator_name}`;
      const departure = document.createElement('td');
      departure.textContent = formatDate(trip.departure_at);
      const seats = document.createElement('td');
      seats.textContent = `${trip.booked_count} / ${trip.seat_capacity}`;
      const status = document.createElement('td');
      status.textContent = trip.trip_status === 'published' ? 'Published' : 'Cancelled';
      const action = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'booking-action secondary';
      button.textContent = trip.trip_status === 'published' ? 'Cancel service' : 'Publish again';
      button.addEventListener('click', async () => {
        try {
          await request('admin-trip-status', { method: 'POST', body: JSON.stringify({ trip_id: trip.trip_id, trip_status: trip.trip_status === 'published' ? 'cancelled' : 'published' }) });
          showMessage(t('Service status updated.'));
          await loadTrips();
        } catch (error) {
          showMessage(t(`error_${error.message}`), true);
        }
      });
      action.append(button);
      row.append(service, departure, seats, status, action);
      table.append(row);
    });
  }

  typeSelect.addEventListener('change', async () => {
    currentType = typeSelect.value;
    try { await loadPlaces(); } catch (error) { showMessage(t(`error_${error.message}`), true); }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const body = Object.fromEntries(values.entries());
    body.departure_at = body.departure_at.replace('T', ' ');
    body.arrival_at = body.arrival_at.replace('T', ' ');
    try {
      await request('admin-create-trip', { method: 'POST', body: JSON.stringify(body) });
      showMessage(t('Service published. Passengers can now book seats.'));
      await loadTrips();
    } catch (error) {
      showMessage(t(`error_${error.message}`), true);
    }
  });

  (async () => {
    try {
      const state = await request('bootstrap');
      if (!state.user || state.user.role !== 'admin') {
        document.querySelector('#admin-denied').hidden = false;
        return;
      }
      document.querySelector('[data-session-name]').textContent = state.user.display_name;
      document.querySelector('#admin-content').hidden = false;
      await loadPlaces();
      await loadTrips();
    } catch (error) {
      document.querySelector('#admin-denied').hidden = false;
      showMessage(t(`error_${error.message}`), true);
    }
  })();
})();
