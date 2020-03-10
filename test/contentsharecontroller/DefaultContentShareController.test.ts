// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as chai from 'chai';
import * as sinon from 'sinon';

import AudioVideoController from '../../src/audiovideocontroller/AudioVideoController';
import NoOpAudioVideoController from '../../src/audiovideocontroller/NoOpAudioVideoController';
import ContentShareConstants from '../../src/contentsharecontroller/ContentShareConstants';
import ContentShareController from '../../src/contentsharecontroller/ContentShareController';
import ContentShareMediaStreamBroker from '../../src/contentsharecontroller/ContentShareMediaStreamBroker';
import DefaultContentShareController from '../../src/contentsharecontroller/DefaultContentShareController';
import ContentShareObserver from '../../src/contentshareobserver/ContentShareObserver';
import NoOpLogger from '../../src/logger/NoOpLogger';
import MeetingSessionConfiguration from '../../src/meetingsession/MeetingSessionConfiguration';
import MeetingSessionCredentials from '../../src/meetingsession/MeetingSessionCredentials';
import MeetingSessionURLs from '../../src/meetingsession/MeetingSessionURLs';
import TimeoutScheduler from '../../src/scheduler/TimeoutScheduler';
import DOMMockBehavior from '../dommock/DOMMockBehavior';
import DOMMockBuilder from '../dommock/DOMMockBuilder';

describe('DefaultContentShareController', () => {
  const expect: Chai.ExpectStatic = chai.expect;

  const domMockBehavior = new DOMMockBehavior();
  let contentShareController: ContentShareController;
  let contentShareMediaStreamBroker: ContentShareMediaStreamBroker;
  let contentShareObserver: NoOpContentShareObserver;
  let audioVideoController: AudioVideoController;
  let mediaStream: MediaStream;
  let domMockBuilder: DOMMockBuilder;

  function makeSessionConfiguration(): MeetingSessionConfiguration {
    const configuration = new MeetingSessionConfiguration();
    configuration.meetingId = 'foo-meeting';
    configuration.urls = new MeetingSessionURLs();
    configuration.urls.audioHostURL = 'https://audiohost.test.example.com';
    configuration.urls.turnControlURL = 'https://turncontrol.test.example.com';
    configuration.urls.signalingURL = 'https://signaling.test.example.com';
    configuration.credentials = new MeetingSessionCredentials();
    configuration.credentials.attendeeId = 'foo-attendee';
    configuration.credentials.joinToken = 'foo-join-token';
    return configuration;
  }

  class ContentShareMediaStreamBrokerMock extends ContentShareMediaStreamBroker {
    async acquireAudioInputStream(): Promise<MediaStream> {
      return this.mediaStream;
    }

    async acquireVideoInputStream(): Promise<MediaStream> {
      return this.mediaStream;
    }

    async acquireDisplayInputStream(
      _streamConstraints: MediaStreamConstraints
    ): Promise<MediaStream> {
      return new MediaStream();
    }
  }

  class NoOpContentShareObserver implements ContentShareObserver {
    contentShareDidStart(): void {}

    contentShareDidStop(): void {}

    contentShareDidPause(): void {}

    contentShareDidUnpause(): void {}
  }

  async function delay(timeoutMs: number = domMockBehavior.asyncWaitMs * 5): Promise<void> {
    await new Promise(resolve => new TimeoutScheduler(timeoutMs).start(resolve));
  }

  it('content share meeting session configure', () => {
    const meetingSessionConfigure = makeSessionConfiguration();
    const contentShareMeetingSessionConfigure = DefaultContentShareController.createContentShareMeetingSessionConfigure(
      meetingSessionConfigure
    );
    expect(contentShareMeetingSessionConfigure.meetingId).to.equal(
      meetingSessionConfigure.meetingId
    );
    expect(contentShareMeetingSessionConfigure.urls).to.equal(meetingSessionConfigure.urls);
    expect(contentShareMeetingSessionConfigure.credentials.attendeeId).to.equal(
      meetingSessionConfigure.credentials.attendeeId + ContentShareConstants.Modality
    );
    expect(contentShareMeetingSessionConfigure.credentials.joinToken).to.equal(
      meetingSessionConfigure.credentials.joinToken + ContentShareConstants.Modality
    );
  });

  describe('content share APIs', () => {
    beforeEach(() => {
      domMockBuilder = new DOMMockBuilder(domMockBehavior);

      contentShareMediaStreamBroker = new ContentShareMediaStreamBrokerMock(new NoOpLogger());
      audioVideoController = new NoOpAudioVideoController();
      contentShareController = new DefaultContentShareController(
        contentShareMediaStreamBroker,
        audioVideoController
      );
      mediaStream = new MediaStream();

      contentShareObserver = new NoOpContentShareObserver();
      contentShareController.addContentShareObserver(contentShareObserver);
    });

    afterEach(() => {
      if (domMockBuilder) {
        domMockBuilder.cleanup();
        domMockBuilder = null;
      }
      contentShareController.removeContentShareObserver(contentShareObserver);
    });

    it('can be constructed', () => {
      expect(contentShareController).to.exist;
    });

    it('startContentShare with video track', async () => {
      // @ts-ignore
      mediaStream.addTrack(new MediaStreamTrack('video-track-id', 'video'));
      const audioVideoSpy = sinon.spy(audioVideoController, 'start');
      const videoTileSpy = sinon.spy(
        audioVideoController.videoTileController,
        'startLocalVideoTile'
      );
      const contentShareObserverSpy = sinon.spy(contentShareObserver, 'contentShareDidStart');
      await contentShareController.startContentShare(mediaStream);
      expect(audioVideoSpy.calledOnce).to.be.true;
      expect(videoTileSpy.calledOnce).to.be.true;
      await delay();
      expect(contentShareObserverSpy.calledOnce).to.be.true;
    });

    it('startContentShare without video track', async () => {
      const audioVideoSpy = sinon.spy(audioVideoController, 'start');
      const videoTileSpy = sinon.spy(
        audioVideoController.videoTileController,
        'startLocalVideoTile'
      );
      const contentShareObserverSpy = sinon.spy(contentShareObserver, 'contentShareDidStart');
      await contentShareController.startContentShare(mediaStream);
      expect(audioVideoSpy.calledOnce).to.be.true;
      expect(videoTileSpy.notCalled).to.be.true;
      await delay();
      expect(contentShareObserverSpy.calledOnce).to.be.true;
    });

    it('startContentShare with null stream', async () => {
      const audioVideoSpy = sinon.spy(audioVideoController, 'start');
      const videoTileSpy = sinon.spy(
        audioVideoController.videoTileController,
        'startLocalVideoTile'
      );
      const contentShareObserverSpy = sinon.spy(contentShareObserver, 'contentShareDidStart');
      await contentShareController.startContentShare(null);
      expect(audioVideoSpy.notCalled).to.be.true;
      expect(videoTileSpy.notCalled).to.be.true;
      await delay();
      expect(contentShareObserverSpy.notCalled).to.be.true;
    });

    it('startContentShareFromScreenCapture', async () => {
      const mediaStreamBrokerSpy = sinon.spy(
        contentShareMediaStreamBroker,
        'acquireScreenCaptureDisplayInputStream'
      );
      const contentShareObserverSpy = sinon.spy(contentShareObserver, 'contentShareDidStart');
      await contentShareController.startContentShareFromScreenCapture();
      expect(mediaStreamBrokerSpy.calledOnce).to.be.true;
      await delay();
      expect(contentShareObserverSpy.calledOnce).to.be.true;
    });

    it('stopContentShare', async () => {
      const audioVideoSpy = sinon.spy(audioVideoController, 'stop');
      const mediaStreamBrokerSpy = sinon.spy(contentShareMediaStreamBroker, 'cleanup');
      const contentShareObserverSpy = sinon.spy(contentShareObserver, 'contentShareDidStop');
      contentShareController.stopContentShare();
      expect(audioVideoSpy.calledOnce).to.be.true;
      expect(mediaStreamBrokerSpy.calledOnce).to.be.true;
      await delay();
      expect(contentShareObserverSpy.calledOnce).to.be.true;
    });

    it('stopContentShare is called if stream ended', async () => {
      const contentShareControllerSpy = sinon.spy(contentShareController, 'stopContentShare');
      const contentShareObserverSpy = sinon.spy(contentShareObserver, 'contentShareDidStop');
      // @ts-ignore
      const mediaVideoTrack = new MediaStreamTrack('video-track-id', 'video');
      mediaStream.addTrack(mediaVideoTrack);
      contentShareController.startContentShare(mediaStream);
      mediaVideoTrack.stop();
      expect(contentShareControllerSpy.calledOnce).to.be.true;
      await delay();
      expect(contentShareObserverSpy.calledOnce).to.be.true;
    });

    it('pauseContentShare', async () => {
      const mediaStreamBrokerSpy = sinon.spy(contentShareMediaStreamBroker, 'toggleMediaStream');
      const contentShareObserverSpy = sinon.spy(contentShareObserver, 'contentShareDidPause');
      contentShareController.pauseContentShare();
      mediaStreamBrokerSpy.calledOnceWith(true);
      await delay();
      expect(contentShareObserverSpy.calledOnce).to.be.true;
    });

    it('unpauseContentShare', async () => {
      const mediaStreamBrokerSpy = sinon.spy(contentShareMediaStreamBroker, 'toggleMediaStream');
      const contentShareObserverSpy = sinon.spy(contentShareObserver, 'contentShareDidUnpause');
      contentShareController.unpauseContentShare();
      mediaStreamBrokerSpy.calledOnceWith(false);
      await delay();
      expect(contentShareObserverSpy.calledOnce).to.be.true;
    });

    it('does not call the observer if it has been removed', async () => {
      const contentShareObserverSpy = sinon.spy(contentShareObserver, 'contentShareDidStart');
      await contentShareController.startContentShare(mediaStream);
      contentShareController.removeContentShareObserver(contentShareObserver);
      await delay();
      expect(contentShareObserverSpy.notCalled).to.be.true;
    });
  });
});
