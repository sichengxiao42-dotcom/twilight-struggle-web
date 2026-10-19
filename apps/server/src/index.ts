import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServer, ServerToClient, Side } from '@ts/shared';
import { createGame, type GameState } from '@ts/game-core';

// 骨架：房间内保存权威 GameState，动作校验与按阵营隐藏手牌在 M3 实现。
const rooms = new Map<string, GameState>();

const http = createServer();
const io = new Server<ClientToServer, ServerToClient>(http, { cors: { origin: true } });

io.on('connection', (socket) => {
  let joined: { roomId: string; side: Side } | null = null;

  socket.on('join', (roomId, side) => {
    if (!rooms.has(roomId)) rooms.set(roomId, createGame(Date.now() >>> 0));
    joined = { roomId, side };
    socket.join(roomId);
    socket.emit('state', rooms.get(roomId));
  });

  socket.on('action', () => {
    if (!joined) return socket.emit('error', 'Join a room first');
    socket.emit('error', 'Actions are not implemented yet');
  });
});

const port = Number(process.env.PORT ?? 3001);
http.listen(port, () => console.log(`server listening on :${port}`));
