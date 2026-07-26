const form = document.getElementById('entry-form');
const errorEl = document.getElementById('form-error');
const ledgerBody = document.getElementById('ledger-body');
const balancesList = document.getElementById('balances-list');
const inventoryForm = document.getElementById('inventory-form');
const inventoryError = document.getElementById('inventory-error');
const inventoryBody = document.getElementById('inventory-body');
const inventoryEmpty = document.getElementById('inventory-empty');

const money = (n) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateFmt = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

async function loadAll() {
  const [entries, balances, inventory] = await Promise.all([
    fetchJSON('/api/entries'),
    fetchJSON('/api/balances'),
    fetchJSON('/api/inventory'),
  ]);

  if (ledgerBody) renderLedger(entries);
  if (balancesList) renderBalances(balances);
  if (inventoryBody) renderInventory(inventory);
}

function renderLedger(entries) {
  if (!entries.length) {
    ledgerBody.innerHTML = `<tr class="empty-row"><td colspan="6">No entries yet.</td></tr>`;
    return;
  }
  ledgerBody.innerHTML = entries
    .map(
      (e) => `
      <tr data-id="${e.id}">
        <td class="col-date">${dateFmt(e.createdAt)}</td>
        <td class="col-note">${e.note ? escapeHtml(e.note) : '—'}</td>
        <td class="col-from"><span class="who">${escapeHtml(e.creditor)}</span></td>
        <td class="col-to"><span class="who">${escapeHtml(e.debitor)}</span></td>
        <td class="col-amount"><span class="amount-figure">$${money(e.amount)}</span></td>
        <td class="col-action"><button class="delete-btn" title="Delete entry" data-id="${e.id}">✕</button></td>
      </tr>`
    )
    .join('');
}

function renderBalances(balances) {
  const names = Object.keys(balances);
  if (!names.length) {
    balancesList.innerHTML = `<p class="empty-note">No entries yet — add one above to see balances.</p>`;
    return;
  }
  balancesList.innerHTML = names
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const v = balances[name];
      let cls = 'is-settled';
      let status = 'Settled';
      if (v > 0.004) { cls = 'is-credit'; status = 'is owed'; }
      else if (v < -0.004) { cls = 'is-debit'; status = 'owes'; }
      return `
        <div class="balance-stamp ${cls}">
          <span class="name">${escapeHtml(name)}</span>
          <span class="amount">${v === 0 ? '$0.00' : (v > 0 ? '+' : '−') + '$' + money(Math.abs(v))}</span>
          <span class="status">${status}</span>
        </div>`;
    })
    .join('');
}

function renderInventory(inventory) {
  if (!inventory.length) {
    inventoryBody.innerHTML = '';
    inventoryEmpty.classList.add('show');
    return;
  }
  inventoryEmpty.classList.remove('show');
  inventoryBody.innerHTML = inventory
    .map((item) => {
      const actionColors = {
        'given': 'var(--danger)',
        'received': 'var(--success)',
        'removed': 'var(--warning)'
      };
      const actionLabels = {
        'given': 'Given to',
        'received': 'Received from',
        'removed': 'Removed from'
      };
      const color = actionColors[item.action] || 'var(--text)';
      return `
      <tr data-id="${item.id}">
        <td>${dateFmt(item.createdAt)}</td>
        <td><strong>${escapeHtml(item.item)}</strong></td>
        <td>${item.quantity}</td>
        <td>${escapeHtml(item.godown)}</td>
        <td>${escapeHtml(item.person)}</td>
        <td><span style="color: ${color}; font-weight: 500;">${actionLabels[item.action]}</span></td>
        <td>${item.note ? escapeHtml(item.note) : '—'}</td>
        <td><button class="delete-btn" title="Delete transaction" data-id="${item.id}">✕</button></td>
      </tr>`;
    })
    .join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const payload = {
      amount: form.amount.value,
      creditor: form.creditor.value,
      debitor: form.debitor.value,
      note: form.note.value,
    };

    try {
      await fetchJSON('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      form.reset();
      await loadAll();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

if (ledgerBody) {
  ledgerBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    try {
      await fetchJSON(`/api/entries/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  });
}

if (inventoryForm) {
  inventoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    inventoryError.textContent = '';
    inventoryError.classList.remove('show');

    const payload = {
      item: inventoryForm.item.value,
      quantity: Number(inventoryForm.quantity.value),
      godown: inventoryForm.godown.value,
      person: inventoryForm.person.value,
      action: inventoryForm.action.value,
      note: inventoryForm.note.value,
    };

    try {
      await fetchJSON('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      inventoryForm.reset();
      await loadAll();
    } catch (err) {
      inventoryError.textContent = err.message;
      inventoryError.classList.add('show');
    }
  });
}

if (inventoryBody) {
  inventoryBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    try {
      await fetchJSON(`/api/inventory/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  });
}

loadAll().catch((err) => {
  if (ledgerBody) {
    ledgerBody.innerHTML = `<tr class="empty-row"><td colspan="6">Couldn't load the ledger: ${escapeHtml(err.message)}</td></tr>`;
  }
  if (balancesList) {
    balancesList.innerHTML = `<p class="empty-note">Couldn't load balances: ${escapeHtml(err.message)}</p>`;
  }
});
