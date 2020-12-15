(function(){
	var app = angular.module('projectRtc', [],
		function($locationProvider){$locationProvider.html5Mode(true);}
    );
	var client = new PeerManager();
	var mediaConfig = {
        audio:true,
        video: false
    };

    app.factory('camera', ['$rootScope', '$window', function($rootScope, $window){
    	var camera = {};
    	camera.preview = $window.document.getElementById('localVideo');

    	camera.start = function(){
			return requestUserMedia(mediaConfig)
			.then(function(stream){			
				attachMediaStream(camera.preview, stream);
				client.setLocalStream(stream);
				camera.stream = stream;
				$rootScope.$broadcast('cameraIsOn',true);
			})
			.catch(Error('Failed to get access to local media.'));
		};
		
    	camera.stop = function(){
    		return new Promise(function(resolve, reject){			
				try {
					//camera.stream.stop() no longer works
         			camera.stream.getTracks().forEach(function (track) {​​ track.stop(); }​​);
					camera.preview.src = '';
					resolve();
				} catch(error) {
					reject(error);
				}
    		})
    		.then(function(result){
    			$rootScope.$broadcast('cameraIsOn',false);
    		});	
		};
		return camera;
    }]);


	app.controller('RemoteStreamsController', ['camera', '$location', '$http', function(camera, $location, $http){
		var socket = io();
		var rtc = this;
		rtc.remoteStreams = [];
		function getStreamById(id) {
		    for(var i=0; i<rtc.remoteStreams.length;i++) {
		    	if (rtc.remoteStreams[i].id === id) {return rtc.remoteStreams[i];}
		    }
		}
		rtc.loadData = function () {
			// get list of streams from the server
			$http.get('/streams.json').success(function(data){
				// filter own stream
				var streams = data.filter(function(stream) {
			      	return stream.id != client.getId();
			    });
			    // get former state
			    for(var i=0; i<streams.length;i++) {
			    	var stream = getStreamById(streams[i].id);
			    	streams[i].isPlaying = (!!stream) ? stream.isPLaying : false;
			    }
			    // save new streams
			    rtc.remoteStreams = streams;
			});
		};

		rtc.view = function(stream){
			client.peerInit(stream.id);
			stream.isPlaying = !stream.isPlaying;
		};
		rtc.call = function(stream){
			/* If json isn't loaded yet, construct a new stream 
			 * This happens when you load <serverUrl>/<socketId> : 
			 * it calls socketId immediatly.
			**/
			if(!stream.id){
				stream = {id: stream, isPlaying: false};
				rtc.remoteStreams.push(stream);
			}
			if(camera.isOn){
				client.toggleLocalStream(stream.id);
				if(stream.isPlaying){
					client.peerRenegociate(stream.id);
				} else {
					client.peerInit(stream.id);
				}
				stream.isPlaying = !stream.isPlaying;
			} else {
				camera.start()
				.then(function(result) {
					client.toggleLocalStream(stream.id);
					if(stream.isPlaying){
						client.peerRenegociate(stream.id);
					} else {
						client.peerInit(stream.id);
					}
					stream.isPlaying = !stream.isPlaying;
				})
				.catch(function(err) {
					console.log(err);
				});
			}
		};

	  var remoteId;
		function getRemoteStreamById() {
            for(var i=0; i<rtc.remoteStreams.length;i++) {
                if (rtc.remoteStreams[i].isPlaying){
                    remoteId = rtc.remoteStreams[i].id;
                    console.log('remoteId  ',remoteId);
                    break;
                }
            }
		}
		
		var isDrawing = false;
		//remoteVideoContainer = document.body;
        remoteVideosContainer.addEventListener('mousedown', e => {
            console.log('SUCCESSS');
            getRemoteStreamById();
            x = e.pageX;
            y = e.pageY;
            isDrawing = true;
            // console.log('x,y    ',x + ","+y);
            socket.emit('mouseEvents',{'x':x,'y':y,'action':'mousedown','to':remoteId,'from':client.getId()});
            
          });
          remoteVideosContainer.addEventListener('mousemove', e => {
              if(isDrawing){
                console.log('SUCCESSS');
				x = e.pageX;
				y = e.pageY;
					console.log('x,y    ',x + ","+y);
				socket.emit('mouseEvents',{'x':x,'y':y,'action':'mousemove','to':remoteId,'from':client.getId()});
			}

            
          });
          remoteVideosContainer.addEventListener('mouseup', e => {
            if(isDrawing){
              console.log('SUCCESSS');
			  x = e.pageX;
			  y = e.pageY;
				isDrawing = false;
			  console.log('x,y    ',x + ","+y);
			  //socket.emit('mouseEvents',{'x':1353.4478,'y':411.4288,'action':'mousemove','to':remoteId,'from':client.getId(),eventTime:97185539, downTime:97185515});
			  //socket.emit('mouseEvents',{'x':1352.2516,'y':409.86432,'action':'mousemove','to':remoteId,'from':client.getId(),eventTime:97185555, downTime:97185515});
			  //socket.emit('mouseEvents',{'x':1351.0997,'y':408.78815,'action':'mousemove','to':remoteId,'from':client.getId(),eventTime:97185572, downTime:97185515});
			  //socket.emit('mouseEvents',{'x':1349.909,'y':407.9403,'action':'mousemove','to':remoteId,'from':client.getId(),eventTime:97185588, downTime:97185515});
			  //socket.emit('mouseEvents',{'x':1349.5273,'y':407.76855,'action':'mousemove','to':remoteId,'from':client.getId(),eventTime:97185594, downTime:97185515});
			  socket.emit('mouseEvents',{'x':x,'y':y,'action':'mouseup','to':remoteId,'from':client.getId()});
            }

          
        });
		//initial load
		rtc.loadData();
    	if($location.url() != '/'){
      		rtc.call($location.url().slice(1));
    	};
	}]);

	app.controller('LocalStreamController',['camera', '$scope', '$window', function(camera, $scope, $window){
		var localStream = this;
		localStream.name = '';
		localStream.link = '';
		localStream.cameraIsOn = false;

		$scope.$on('cameraIsOn', function(event,data) {
    		$scope.$apply(function() {
		    	localStream.cameraIsOn = data;
		    });
		});

		localStream.toggleCam = function(){
			if(localStream.cameraIsOn){
				camera.stop()
				.then(function(result){
					client.send('leave');
	    			client.setLocalStream(null);
				})
				.catch(function(err) {
					console.log(err);
				});
			} else {
				camera.start()
				.then(function(result) {
					localStream.link = $window.location.host + '/' + client.getId();
					client.send('readyToStream', { name: localStream.name });
				})
				.catch(function(err) {
					console.log(err);
				});
			}
		};
	}]);
})();
