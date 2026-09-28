const { io } = require('socket.io-client');

const eventId = process.argv[2];
const port = process.argv[3] || '3000';

if (!eventId) {
  console.error('Usage: node scripts/ws-test.js <eventId> [port]');
  process.exit(1);
}

let updateCount = 0;

const socket = io(`http://localhost:${port}/seats`, {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log(`Connected to port ${port}:`, socket.id);

  socket.emit('join-event', {
    eventId,
  });
});

socket.on('joined-event', (data) => {
  console.log('Joined event room:', data);
});

socket.on('seat.updated', (data) => {
  updateCount += 1;

  console.log(`\nSeat update #${updateCount}`);
  console.log(data);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
