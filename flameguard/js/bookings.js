(() => {
  const list = document.querySelector('#booking-list');
  const empty = document.querySelector('#booking-empty');
  const errorBox = document.querySelector('#booking-error');
  const toast = document.querySelector('#booking-toast');
  const t = (key, values) => window.FlameGuardI18n.t(key, values);
  let csrf = '';
  let bookings = [];
  let filter = 'all';

  async function request(action, options = {}) {
    const headers = { 'Accept': 'application/json' };
    if (options.body) {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = csrf;
    }
    const response = await fetch(`api.php?action=${encodeURIComponent(action)}`, { credentials: 'same-origin', ...options, headers: { ...headers, ...(options.headers || {}) } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'server_error');
    if (data.csrf) csrf = data.csrf;
    return data;
  }

  function message(text) {
    toast.textContent = text;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function formatDate(value) {
    const date = new Date(String(value).replace(' ', 'T'));
    return new Intl.DateTimeFormat(window.FlameGuardI18n.getLanguage(), { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Warsaw' }).format(date);
  }

  function createText(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }

  function render() {
    list.replaceChildren();
    const shown = bookings.filter((booking) => filter === 'all' || booking.travel_type === filter);
    empty.hidden = shown.length > 0;
    empty.textContent = bookings.length ? t('noBookingsFilter') : t('noBookingsYet');
    shown.forEach((booking) => {
      const article = document.createElement('article');
      article.className = 'booking-card';
      article.dataset.bookingKind = booking.travel_type;
      const symbol = createText('div', `booking-symbol${booking.travel_type === 'train' ? ' train' : ''}`, booking.travel_type === 'train' ? '🚆' : '✈');
      symbol.setAttribute('aria-hidden', 'true');
      const details = createText('div', 'booking-details', '');
      const labels = createText('div', 'booking-labels', '');
      labels.append(createText('span', `tag${booking.travel_type === 'train' ? ' train-tag' : ''}`, t(booking.travel_type === 'train' ? 'Train' : 'Flight')));
      labels.append(createText('span', 'booking-reference', booking.booking_code));
      const stateKey = booking.trip_status === 'cancelled' ? 'serviceCancelled' : (booking.booking_status === 'confirmed' ? 'reservationConfirmed' : 'reservationCancelled');
      labels.append(createText('span', 'status-pill', t(stateKey)));
      const route = createText('div', 'booking-route', '');
      const origin = createText('span', '', '');
      origin.append(createText('strong', '', booking.origin_code), createText('small', '', booking.origin_name));
      const arrow = createText('span', 'booking-route-line', '────────→');
      arrow.setAttribute('aria-hidden', 'true');
      const destination = createText('span', '', '');
      destination.append(createText('strong', '', booking.destination_code), createText('small', '', booking.destination_name));
      route.append(origin, arrow, destination);
      const meta = createText('p', 'booking-meta', `${formatDate(booking.departure_at)} · ${t('seatLabel')}: ${booking.seat_code} · ${booking.operator_name}`);
      details.append(labels, route, meta);
      const actions = createText('div', 'booking-actions', '');
      actions.append(createText('strong', 'booking-price', `${booking.fare_points} RP`));
      const valid = booking.booking_status === 'confirmed' && booking.trip_status === 'published';
      const ticket = createText('button', 'booking-action', t('View ticket'));
      ticket.type = 'button';
      ticket.disabled = !valid;
      ticket.addEventListener('click', () => window.FlameGuardTickets.download(booking, window.FlameGuardI18n.getLanguage()));
      actions.append(ticket);
      if (valid && new Date(String(booking.departure_at).replace(' ', 'T')) > new Date()) {
        const cancel = createText('button', 'booking-action secondary', t('cancelReservation'));
        cancel.type = 'button';
        cancel.addEventListener('click', async () => {
          if (!window.confirm(t('confirmCancelReservation'))) return;
          try {
            await request('cancel-booking', { method: 'POST', body: JSON.stringify({ booking_id: booking.booking_id }) });
            await loadBookings();
            message(t('reservationCancelledToast'));
          } catch (error) {
            message(t(`error_${error.message}`));
          }
        });
        actions.append(cancel);
      }
      article.append(symbol, details, actions);
      list.append(article);
    });
  }

  async function loadBookings() {
    const data = await request('bookings');
    bookings = data.bookings;
    const name = document.querySelector('[data-session-name]');
    if (name) name.textContent = data.user.display_name;
      name.hidden = false;
      document.querySelector('#account-button').hidden = true;
      const logoutButton = document.querySelector('#logout-button');
      logoutButton.hidden = false;
      logoutButton.addEventListener('click', async () => {
        try {
          await request('logout', { method: 'POST', body: '{}' });
          window.location.href = 'index.html';
        } catch (error) { message(t(`error_${error.message}`)); }
      });
    render();
  }

  document.querySelectorAll('[data-booking-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.bookingFilter;
      document.querySelectorAll('[data-booking-filter]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      render();
    });
  });

  (async () => {
    try {
      const bootstrap = await request('bootstrap');
      csrf = bootstrap.csrf;
      if (!bootstrap.user) {
        empty.replaceChildren();
        empty.hidden = false;
        const text = document.createTextNode(`${t('signInToViewBookings')} `);
        const link = document.createElement('a');
        link.href = 'index.html#login';
        link.textContent = t('Sign in');
        empty.append(text, link);
        document.querySelector('[data-session-name]').hidden = true;
        document.querySelector('#logout-button').hidden = true;
        return;
      }
      if (bootstrap.user.role === 'admin') document.querySelectorAll('[data-admin-link]').forEach((link) => { link.hidden = false; });
      await loadBookings();
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = t(`error_${error.message}`);
      empty.hidden = true;
    }
  })();
})();
