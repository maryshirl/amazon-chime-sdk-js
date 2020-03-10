// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AudioVideoController from '../audiovideocontroller/AudioVideoController';
import ContentShareObserver from '../contentshareobserver/ContentShareObserver';
import Maybe from '../maybe/Maybe';
import MeetingSessionConfiguration from '../meetingsession/MeetingSessionConfiguration';
import MeetingSessionCredentials from '../meetingsession/MeetingSessionCredentials';
import AsyncScheduler from '../scheduler/AsyncScheduler';
import ContentShareConstants from './ContentShareConstants';
import ContentShareController from './ContentShareController';
import ContentShareMediaStreamBroker from './ContentShareMediaStreamBroker';

export default class DefaultContentShareController implements ContentShareController {
  static createContentShareMeetingSessionConfigure(
    configuration: MeetingSessionConfiguration
  ): MeetingSessionConfiguration {
    const contentShareConfiguration = new MeetingSessionConfiguration();
    contentShareConfiguration.meetingId = configuration.meetingId;
    contentShareConfiguration.urls = configuration.urls;
    contentShareConfiguration.credentials = new MeetingSessionCredentials();
    contentShareConfiguration.credentials.attendeeId =
      configuration.credentials.attendeeId + ContentShareConstants.Modality;
    contentShareConfiguration.credentials.joinToken =
      configuration.credentials.joinToken + ContentShareConstants.Modality;
    return contentShareConfiguration;
  }

  private observerQueue: Set<ContentShareObserver> = new Set<ContentShareObserver>();

  constructor(
    private mediaStreamBroker: ContentShareMediaStreamBroker,
    private audioVideo: AudioVideoController
  ) {}

  async startContentShare(stream: MediaStream): Promise<void> {
    if (!stream) {
      return;
    }
    this.mediaStreamBroker.mediaStream = stream;
    for (let i = 0; i < this.mediaStreamBroker.mediaStream.getTracks().length; i++) {
      this.mediaStreamBroker.mediaStream.getTracks()[i].addEventListener('ended', () => {
        this.stopContentShare();
      });
    }
    this.audioVideo.start();
    if (this.mediaStreamBroker.mediaStream.getVideoTracks().length > 0) {
      this.audioVideo.videoTileController.startLocalVideoTile();
    }
    this.forEachContentShareObserver(observer => {
      Maybe.of(observer.contentShareDidStart).map(f => f.bind(observer)());
    });
  }

  async startContentShareFromScreenCapture(sourceId?: string): Promise<void> {
    const mediaStream = await this.mediaStreamBroker.acquireScreenCaptureDisplayInputStream(
      sourceId
    );
    await this.startContentShare(mediaStream);
  }

  pauseContentShare(): void {
    this.mediaStreamBroker.toggleMediaStream(false);
    this.forEachContentShareObserver(observer => {
      Maybe.of(observer.contentShareDidPause).map(f => f.bind(observer)());
    });
  }

  unpauseContentShare(): void {
    this.mediaStreamBroker.toggleMediaStream(true);
    this.forEachContentShareObserver(observer => {
      Maybe.of(observer.contentShareDidUnpause).map(f => f.bind(observer)());
    });
  }

  stopContentShare(): void {
    this.audioVideo.stop();
    this.mediaStreamBroker.cleanup();
    this.forEachContentShareObserver(observer => {
      Maybe.of(observer.contentShareDidStop).map(f => f.bind(observer)());
    });
  }

  addContentShareObserver(observer: ContentShareObserver): void {
    this.observerQueue.add(observer);
  }

  removeContentShareObserver(observer: ContentShareObserver): void {
    this.observerQueue.delete(observer);
  }

  forEachContentShareObserver(observerFunc: (observer: ContentShareObserver) => void): void {
    for (const observer of this.observerQueue) {
      new AsyncScheduler().start(() => {
        if (this.observerQueue.has(observer)) {
          observerFunc(observer);
        }
      });
    }
  }
}
