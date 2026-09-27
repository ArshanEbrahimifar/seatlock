const { io } = require('socket.io-client');

const eventId = process.argv[2];

if (!eventId) {
  console.error('Usage: node scripts/ws-test.js <eventId>');
  process.exit(1);
}

const socket = io('http://localhost:3000/seats', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);

  socket.emit('join-event', {
    eventId,
  });
});

socket.on('joined-event', (data) => {
  console.log('Joined event room:', data);
});

socket.on('seat.updated', (data) => {
  console.log('Seat updated:');
  console.log(data);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
