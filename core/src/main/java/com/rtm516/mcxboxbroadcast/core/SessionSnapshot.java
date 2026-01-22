package com.rtm516.mcxboxbroadcast.core;

public record SessionSnapshot(String sessionId, String handleId, long epoch, SessionState state) {
}
