(() => {
  const t = (key, values) => window.FlameGuardI18n.t(key, values);
  const originSelect = document.querySelector('#origin-select');
  const destinationSelect = document.querySelector('#destination-select');
  const departDate = document.querySelector('#depart-date');
  const results = document.querySelector('#route-results');
  const empty = document.querySelector('#routes-empty');
  const seatGrid = document.querySelector('#seat-grid');
  const seatNumber = document.querySelector('#seat-number');
  const checkout = document.querySelector('#checkout');
  const toast = document.querySelector('#toast');
  const authDialog = document.querySelector('#auth-dialog');
  const authMessage = document.querySelector('#auth-message');
  let csrf = '';
  let user = null;
  let travelType = 'flight';
  let selectedTrip = null;
  let selectedSeat = '';
  let toastTimer;

  function showToast(text, isError = false) {
    toast.textContent = text;
    toast.classList.toggle('toast-error', isError);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3500);
  }

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

  function updateAccount() {
    const name = document.querySelector('[data-session-name]');
    const accountButton = document.querySelector('#account-button');
    const logoutButton = document.querySelector('#logout-button');
    const adminLink = document.querySelector('[data-admin-link]');
    if (user) {
      name.textContent = user.display_name;
      name.hidden = false;
      accountButton.textContent = t('My bookings');
      logoutButton.hidden = false;
      adminLink.hidden = user.role !== 'admin';
      document.querySelector('#account-summary').textContent = t('accountWelcome', { name: user.display_name });
    } else {
      name.hidden = true;
      logoutButton.hidden = true;
      adminLink.hidden = true;
      accountButton.textContent = t('Sign in');
      document.querySelector('#account-summary').textContent = t('Sign in to manage your FlameGuard journeys.');
    }
  }

  function optionFor(place) {
    const option = document.createElement('option');
    option.value = place.code;
    option.textContent = `${place.place_name} (${place.code})`;
    return option;
  }

  async function loadPlaces(preferredOrigin, preferredDestination) {
    const data = await request(`places&kind=${travelType}`);
    originSelect.replaceChildren();
    destinationSelect.replaceChildren();
    data.places.forEach((place) => {
      originSelect.append(optionFor(place));
      destinationSelect.append(optionFor(place));
    });
    const origin = preferredOrigin || (travelType === 'flight' ? 'PRG' : 'STC');
    const destination = preferredDestination || (travelType === 'flight' ? 'STI' : 'STA');
    if ([...originSelect.options].some((option) => option.value === origin)) originSelect.value = origin;
    if ([...destinationSelect.options].some((option) => option.value === destination)) destinationSelect.value = destination;
    if (!destinationSelect.value && destinationSelect.options.length > 1) destinationSelect.selectedIndex = 1;
    updateRouteView();
  }

  function selectedPlace(select) {
    const option = select.selectedOptions[0];
    if (!option) return { code: '—', name: '' };
    const match = option.textContent.match(/^(.*) \(([A-Z0-9]+)\)$/);
    return match ? { name: match[1], code: match[2] } : { code: option.value, name: option.textContent };
  }

  function updateRouteView() {
    const origin = selectedPlace(originSelect);
    const destination = selectedPlace(destinationSelect);
    document.querySelector('#from-code').textContent = origin.code;
    document.querySelector('#from-city').textContent = origin.name;
    document.querySelector('#to-code').textContent = destination.code;
    document.querySelector('#to-city').textContent = destination.name;
    document.querySelector('#map-from-label').textContent = origin.code;
    document.querySelector('#map-to-label').textContent = destination.code;
    document.querySelector('#journey-metric').textContent = `${origin.code} → ${destination.code}`;
    document.querySelector('#journey-details').textContent = `${origin.name} → ${destination.name} · ${departDate.value}`;
    document.querySelector('#journey-status').textContent = travelType === 'flight' ? t('Flights') : t('Trains');
    document.querySelector('#journey-progress').textContent = t('RP service');
    document.querySelector('#upcoming-title').textContent = t('Your account');
    document.querySelector('#upcoming-icon').textContent = travelType === 'train' ? '🚆' : '✈';
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat(window.FlameGuardI18n.getLanguage(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Warsaw' }).format(new Date(String(value).replace(' ', 'T')));
  }

  function selectTrip(trip, button) {
    selectedTrip = trip;
    selectedSeat = '';
    checkout.disabled = true;
    seatNumber.textContent = '—';
    document.querySelector('#checkout-price').textContent = `${trip.fare_points} RP →`;
    document.querySelectorAll('[data-trip-select]').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelector('#journey-details').textContent = `${trip.origin_name} → ${trip.destination_name} · ${formatTime(trip.departure_at)}–${formatTime(trip.arrival_at)}`;
    loadSeats(trip.trip_id)
      .then(() => { document.querySelector('#cabin-secondary').textContent = t('Choose an available seat'); })
      .catch((error) => showToast(t(`error_${error.message}`), true));
  }

  async function loadSeats(tripId) {
    seatGrid.replaceChildren();
    const data = await request(`seats&trip_id=${encodeURIComponent(tripId)}`);
    const occupied = new Set(data.occupied);
    const columns = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (let index = 0; index < data.capacity; index += 1) {
      const code = `${Math.floor(index / 6) + 1}${columns[index % 6]}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `seat${occupied.has(code) ? ' occupied' : ''}`;
      button.textContent = code;
      button.disabled = occupied.has(code);
      button.setAttribute('aria-label', `${t('Seat')} ${code}${occupied.has(code) ? `, ${t('Occupied').toLowerCase()}` : ''}`);
      button.addEventListener('click', () => {
        seatGrid.querySelector('.selected')?.classList.remove('selected');
        button.classList.add('selected');
        selectedSeat = code;
        seatNumber.textContent = code;
        checkout.disabled = false;
      });
      seatGrid.append(button);
    }
  }

  function renderTrips(trips) {
    results.replaceChildren();
    empty.hidden = trips.length > 0;
    empty.textContent = trips.length ? '' : t('noDeparturesForSearch');
    trips.forEach((trip) => {
      const row = document.createElement('tr');
      row.className = 'trip-row';
      row.dataset.searchText = `${trip.operator_name} ${trip.origin_name} ${trip.destination_name} ${trip.origin_code} ${trip.destination_code}`.toLowerCase();
      const operatorCell = document.createElement('td');
      const operator = document.createElement('span');
      operator.className = 'airline';
      const badge = document.createElement('span');
      badge.className = 'airline-dot';
      badge.textContent = 'FG';
      const operatorName = document.createElement('strong');
      operatorName.textContent = trip.operator_name;
      operator.append(badge, operatorName);
      operatorCell.append(operator);
      const departureCell = document.createElement('td');
      departureCell.textContent = formatTime(trip.departure_at);
      const arrivalCell = document.createElement('td');
      arrivalCell.textContent = formatTime(trip.arrival_at);
      const seatsCell = document.createElement('td');
      seatsCell.textContent = trip.seats_left;
      const fareCell = document.createElement('td');
      fareCell.textContent = `${trip.fare_points} RP`;
      const actionCell = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'booking-action';
      button.dataset.tripSelect = String(trip.trip_id);
      button.textContent = t('Select');
      button.disabled = trip.seats_left < 1;
      button.addEventListener('click', () => selectTrip(trip, button));
      actionCell.append(button);
      row.append(operatorCell, departureCell, arrivalCell, seatsCell, fareCell, actionCell);
      results.append(row);
    });
  }

  async function searchTrips() {
    const origin = originSelect.value;
    const destination = destinationSelect.value;
    if (!origin || !destination || origin === destination || !departDate.value) {
      showToast(t('chooseDifferentPlaces'), true);
      return;
    }
    selectedTrip = null;
    selectedSeat = '';
    seatNumber.textContent = '—';
    seatGrid.replaceChildren();
    checkout.disabled = true;
    results.replaceChildren();
    empty.hidden = false;
    empty.textContent = t('Searching…');
    updateRouteView();
    try {
      const query = new URLSearchParams({ kind: travelType, origin, destination, date: departDate.value });
      const data = await request(`trips&${query.toString()}`);
      renderTrips(data.trips);
    } catch (error) {
      empty.hidden = false;
      empty.textContent = t(`error_${error.message}`);
    }
  }

  function openAuth(view = 'login') {
    document.querySelectorAll('[data-auth-tab]').forEach((tab) => {
      const active = tab.dataset.authTab === view;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    document.querySelector('#login-form').hidden = view !== 'login';
    document.querySelector('#register-form').hidden = view !== 'register';
    authMessage.textContent = '';
    if (typeof authDialog.showModal === 'function') authDialog.showModal();
    else authDialog.setAttribute('open', '');
  }

  async function submitAuth(event, action) {
    event.preventDefault();
    authMessage.textContent = '';
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const data = await request(action, { method: 'POST', body: JSON.stringify(body) });
      csrf = data.csrf;
      user = data.user;
      updateAccount();
      authDialog.close();
      form.reset();
      showToast(t(action === 'register' ? 'accountCreated' : 'signedIn'));
      if (selectedTrip && selectedSeat) await createBooking();
    } catch (error) {
      authMessage.textContent = t(`error_${error.message}`);
      authMessage.classList.add('error');
    }
  }

  async function createBooking() {
    if (!selectedTrip || !selectedSeat) {
      showToast(t('chooseAServiceAndSeat'), true);
      return;
    }
    if (!user) {
      openAuth('login');
      return;
    }
    checkout.disabled = true;
    try {
      const data = await request('create-booking', { method: 'POST', body: JSON.stringify({ trip_id: selectedTrip.trip_id, seat_code: selectedSeat }) });
      showToast(t('reservationConfirmedToast', { code: data.booking.booking_code }));
      await searchTrips();
      if (window.confirm(t('openBookingsNow'))) window.location.href = 'bookings.html';
    } catch (error) {
      showToast(t(`error_${error.message}`), true);
      selectedSeat = '';
      seatNumber.textContent = '—';
      checkout.disabled = true;
      if (selectedTrip) {
        try { await loadSeats(selectedTrip.trip_id); }
        catch (seatError) { showToast(t(`error_${seatError.message}`), true); }
      }
    } finally {
      checkout.disabled = !(selectedTrip && selectedSeat && user);
    }
  }

  async function changeMode(type) {
    travelType = type;
    selectedTrip = null;
    selectedSeat = '';
    seatGrid.replaceChildren();
    checkout.disabled = true;
    document.querySelectorAll('[data-travel-mode]').forEach((tab) => {
      const active = tab.dataset.travelMode === type;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    document.querySelector('#upcoming-title').textContent = t(type === 'train' ? 'Trains' : 'Flights');
    document.querySelector('#seat-title').textContent = t('Select seats');
    document.querySelector('#cabin-primary').textContent = t('Available seats');
    document.querySelector('#cabin-secondary').textContent = t('Choose a service to load seats');
    document.querySelector('#table-title').textContent = t('Available departures');
    document.querySelector('#operator-heading').textContent = t('Operator');
    document.querySelector('#search-travel').textContent = t(type === 'train' ? 'searchTrains' : 'searchFlights');
    try {
      await loadPlaces();
      await searchTrips();
    } catch (error) {
      showToast(t(`error_${error.message}`), true);
    }
  }

  document.querySelectorAll('[data-travel-mode]').forEach((tab) => tab.addEventListener('click', () => changeMode(tab.dataset.travelMode)));
  document.querySelector('#search-travel').addEventListener('click', searchTrips);
  originSelect.addEventListener('change', updateRouteView);
  destinationSelect.addEventListener('change', updateRouteView);
  departDate.addEventListener('change', updateRouteView);
  document.querySelector('#swap-route').addEventListener('click', () => {
    const origin = originSelect.value;
    const destination = destinationSelect.value;
    if ([...originSelect.options].some((option) => option.value === destination) && [...destinationSelect.options].some((option) => option.value === origin)) {
      originSelect.value = destination;
      destinationSelect.value = origin;
      updateRouteView();
    }
  });
  document.querySelector('#checkout').addEventListener('click', createBooking);
  document.querySelector('#account-button').addEventListener('click', () => user ? window.location.assign('bookings.html') : openAuth('login'));
  document.querySelector('#logout-button').addEventListener('click', async () => {
    try {
      await request('logout', { method: 'POST', body: '{}' });
      window.location.reload();
    } catch (error) { showToast(t(`error_${error.message}`), true); }
  });
  document.querySelector('#auth-close').addEventListener('click', () => authDialog.close());
  document.querySelectorAll('[data-auth-tab]').forEach((tab) => tab.addEventListener('click', () => openAuth(tab.dataset.authTab)));
  document.querySelector('#login-form').addEventListener('submit', (event) => submitAuth(event, 'login'));
  document.querySelector('#register-form').addEventListener('submit', (event) => submitAuth(event, 'register'));
  document.querySelector('.search input').addEventListener('input', (event) => {
    const search = event.currentTarget.value.trim().toLowerCase();
    document.querySelectorAll('.trip-row').forEach((row) => { row.hidden = !row.dataset.searchText.includes(search); });
  });
  window.addEventListener('flameguard:languagechange', () => {
    updateAccount();
    if (selectedTrip) document.querySelector('#journey-status').textContent = t(travelType === 'flight' ? 'Flights' : 'Trains');
  });

  (async () => {
    try {
      const today = new Date();
      departDate.value = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
      const state = await request('bootstrap');
      csrf = state.csrf;
      user = state.user;
      updateAccount();
      checkout.disabled = true;
      await loadPlaces();
      if (window.location.hash === '#login') openAuth('login');
      else if (window.location.hash === '#register') openAuth('register');
    } catch (error) {
      showToast(t(`error_${error.message}`), true);
    }
  })();
})();
