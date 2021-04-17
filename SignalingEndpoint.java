package de.poro.streaming;

import java.io.IOException;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;

import jakarta.websocket.EncodeException;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnMessage;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.ServerEndpoint;

/**
 * Signaling server endpoint for WebRTC based video conference.
 */
@ServerEndpoint("/signal")
public class SignalingEndpoint {

	private final static Logger LOGGER = Logger.getLogger(SignalingEndpoint.class.getName());

	private static final Set<Session> sessions = Collections.synchronizedSet(new HashSet<Session>());

	/**
	 * Open session and store it in global set.
	 * 
	 * @param session
	 * @throws IOException
	 * @throws EncodeException
	 */
	@OnOpen
	public void onOpen(Session session) throws IOException, EncodeException {
		LOGGER.log(Level.INFO, "Opening connection");
		sessions.add(session);
	}

	/**
	 * Simply send sessions to all other participants.
	 * 
	 * @param data
	 * @param session
	 * @throws IOException
	 */
	@OnMessage
	public void onMessage(String message, Session session) throws IOException {
		LOGGER.log(Level.INFO, "Received signal: " + message);
		for (Session s : sessions) {
			if (!s.equals(session)) {
				s.getBasicRemote().sendText(message);
			}
		}
	}

	/**
	 * Remove session when closing connection.
	 * 
	 * @param session
	 */
	@OnClose
	public void onClose(Session session) {
		LOGGER.log(Level.INFO, "Closing session");
		sessions.remove(session);
	}

}
