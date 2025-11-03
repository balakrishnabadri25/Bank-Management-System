// Function to create a new account
function created_acc() {
    const name = document.getElementById('name').value;
    const balance = document.getElementById('initial_deposit').value;

    if (!name || !balance) {
        document.getElementById('result').innerText = 'Please fill in all fields.';
        return;
    }

    fetch('http://localhost:8080/create_acc', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uname: name, balance: parseInt(balance) })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('result').innerText = data.message || 'Account created successfully!';
    })
    .catch(error => {
        document.getElementById('result').innerText = 'Error creating account: ' + error.message;
    });
}

// Function to deposit money
function deposit() {
    const accno = document.getElementById('accno').value;
    const amount = document.getElementById('amount').value;

    if (!accno || !amount) {
        document.getElementById('result').innerText = 'Please fill in all fields.';
        return;
    }

    fetch('http://localhost:8080/deposit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ acc_id: accno, amount: parseFloat(amount) })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('result').innerText = data.message || 'Deposit successful!';
    })
    .catch(error => {
        document.getElementById('result').innerText = 'Error depositing: ' + error.message;
    });
}

// Function to withdraw money
function withdraw() {
    const accno = document.getElementById('accno').value;
    const amount = document.getElementById('amount').value;

    if (!accno || !amount) {
        document.getElementById('result').innerText = 'Please fill in all fields.';
        return;
    }

    fetch('http://localhost:8080/withdraw', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ acc_id: accno, amount: parseFloat(amount) })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('result').innerText = data.message || 'Withdrawal successful!';
    })
    .catch(error => {
        document.getElementById('result').innerText = 'Error withdrawing: ' + error.message;
    });
}

// Function to check balance
function check_bal() {
    const accno = document.getElementById('accno').value;

    if (!accno) {
        document.getElementById('result').innerText = 'Please enter account number.';
        return;
    }

    fetch(`http://localhost:8080/check_balance?acc_id=${accno}`)
    .then(response => response.json())
    .then(data => {
        document.getElementById('result').innerText = data.message || `Balance: ${data.balance}`;
    })
    .catch(error => {
        document.getElementById('result').innerText = 'Error checking balance: ' + error.message;
    });
}
