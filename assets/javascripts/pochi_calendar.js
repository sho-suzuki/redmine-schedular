
// Angularの設計課題

'use strict';

var calendarApp = angular.module('calendarApp', ['ui.calendar',
                                                 'ui.bootstrap',
                                                 'eventService',
                                                 'eventsService',
                                                 'licenseParticipationService']);

calendarApp.config([
  "$httpProvider", function($httpProvider) {
    $httpProvider.defaults.headers.common['X-CSRF-Token'] = $('meta[name=csrf-token]').attr('content');
  }
]);

calendarApp.run(function($rootScope, $location) {
  $rootScope.location = $location;
});

var eventService = angular.module('eventService', ['ngResource']);
eventService.factory('EventBB', function($resource) {
  return $resource('/projects/:project_id/schedulers/:schedule_id/events/:event_id', {
    project_id: '@project_id',
    schedule_id: '@schedule_id',
    event_id: '@event_id',
    format: 'json'
  }, {
    update: {
      method: 'PUT'
    }
  });
});

eventService.factory("LicenseManager", function(License) {
  var Licenses = {
    current: {},
    visible_events: []
  };

  Licenses.push = function(license_json) {
    var license = new License(license_json);
    this.current[license_json.id] = new License(license_json);
    this.current[license_json.id].push(license_json.events);
    var self = this;
    if(this.current[license_json.id].is_visible())
      angular.forEach(this.current[license_json.id].events, function(e) {
        self.visible_events.push(e);
      });
  };

  Licenses.find = function(event) {
    return this.current[event.schedule_id];
  };

  return Licenses;
});

eventService.factory("License", function($resource) {
  var License = $resource('/projects/:project_id/schedulers/:schedule_id/participations', {
    project_id: '@project_id',
    schedule_id: '@schedule_id',
    format: 'json'
  });

  var LicenseService = function(license) {
    this.events = [];

    this.initialize = function(license) {
      var _split_url = location.href.split("/");
      var project_id = _split_url[_split_url.length - 3];

      this.current = new License();
      this.current.project_id = project_id;
      this.current.schedule_id = license.id;
      this.color = license.color;
      this.title = license.name;
      this.events = [];
      this.visible = license.visiable ? 'active' : 'hidden-decorator';
    };

    this.push = function(events) {
      var self = this;

      angular.forEach(events, function(e) {
        var team_name = $("#teams").data("articles")[e.event.team_id];
        var title = e.event.content ? team_name + "-" + e.event.username + "(" + e.event.content + ")" : team_name + "-" + e.event.username;
        var event = {title: title,
                     _id: e.event.id,
                     content: e.event.content,
                     start: e.event.start_date,
                     end: e.event.end_date,
                     username: e.event.username,
                     team: e.event.team_id,
                     _schedule_id: e.event.schedule_id,
                     backgroundColor: self.color,
                     borderColor: 'white'
                    };
        self.events.push(event);
      });
    };

    this.is_visible = function(){
      return this.visible === "active";
    };

    // angular.copyしないと参照先要素が書きかわり、2回目のリクエストで失敗する
    this.save = function(success, error) {
      var self = this;
      var current = angular.copy(this.current);
      var master_filter = function(e,_) {
        self.visible = 'hidden-decorator';
        success(self.events);
      };

      current.$save(master_filter, error);
    };

    this.delete = function(success, error) {
      var self = this;
      var current = angular.copy(this.current);
      var callback = function(e,_) {
        success(self.events);
        self.visible = 'active';
      };
      current.$delete(callback, error);
    };

    this.initialize.apply(this, arguments);
  };

  return LicenseService;
});

eventService.factory("Event", function($resource, LicenseManager) {
  var Event = $resource('/projects/:project_id/schedulers/:schedule_id/events/:event_id', {
    project_id: '@project_id',
    schedule_id: '@schedule_id',
    event_id: '@event_id',
    format: 'json'
  }, {
    update: {
      method: 'PUT'
    }
  });

  var EventService = function(options) {

    this.initialize = function(options) {
      this.current = new Event();
      this.setDate(options.start, options.end);
      this.current.project_id = options.project_id;
      this.current.user = options.user_id;
      this.current.username = options.username;
      this.current.team_id = options.team;
      this.current.schedule_id = options._schedule_id;
      this.current.event_id = options._id;
      this.current.content = options.content;
    };

    this.setDate = function(start, end) {
      end = (end === null) ? start : end;
      this.start = start;
      this.end = end;
      this.current.start_date = start.getFullYear() + "-" + (start.getMonth() + 1) + "-" + start.getDate();
      this.current.end_date = end.getFullYear() + "-" + (end.getMonth() + 1) + "-" + end.getDate();
    };

    this.start_date = function() {
      return (this.start.getMonth() + 1) + " 月 " + this.start.getDate() + " 日";
    };

    this.end_date = function() {
      return (this.end.getMonth() + 1) + " 月 " + this.end.getDate() + " 日";
    };


    // LicenseManagerを色の依存関係だけのために使うか
    this.to_calendar = function(event) {
      var team_name = $("#teams").data("articles")[event.team_id];
      var title = e.event.content ? team_name + "-" + e.event.username + "(" + e.event.content + ")" : team_name + "-" + e.event.username;
      return {
        title: title,
        content: event.content,
        _id: event.id,
        start: event.start_date,
        end: event.end_date,
        username: event.username,
        team: event.team_id,
        _schedule_id: event.schedule_id,
        backgroundColor: LicenseManager.find(event).color,
        borderColor: 'white'
      };
    };

    this.set_id = function(event) {
      this._id = event.id;
    };

    this.create = function(success, error) {
      var self = this;
      var callback = function(e, _) {
        self.set_id(e.event);
        success(self.to_calendar(e.event));
      };
      this.current.$save(callback, error);
    };

    this.initialize.apply(this, arguments);
  };

  return EventService;
});

eventService.factory("EventManager", function($resource, Event) {
  var Events = $resource('/projects/:project_id/schedulers/', {
    project_id: '@project_id',
    year: '@year',
    month: '@month',
    format: 'json'
  }, {
    query: {
      method: 'GET',
      isArray: true
    }
  });

  var EventManager = {
    current: [],
    show_calendar: [],

    loaded: {},

    get: function(options, callback) {
      var current_month = options.year + options.month;
      var self = this;
      var manager_callback = function(response, header) {
        self.loaded[current_month] = true;
        callback(response, header);
      };

      if (this.loaded[current_month] === undefined)
        Events.get(options, manager_callback);
    }
  };

  return EventManager;
});


calendarApp.directive('eventFormModal', function(Event) {
  return {
    restrict: 'A',
    link: function(scope, element, attr) {
      // TODO: Refactoring get project_id more smart.
      var _split_url = location.href.split("/");
      var project_id = _split_url[_split_url.length - 3];

      scope.eventForm = false;
      scope.currentEvent = {
        deleteable: false
      };

      scope.closeEventForm = function() {
        scope.eventForm = false;
      };

      // New
      scope.showEventForm = function(start, end) {
        scope.currentEvent = {
          title: '新規作成',
          submitText: '作成'
        };

        scope.formEvent = new Event({project_id: project_id,
                                     start: start,
                                     end: end});
        scope.eventForm = true;
      };

      // Edit
      scope.showEditEventForm = function(event) {
        scope.currentEvent = {
          title: '更新',
          submitText: '更新'
        };

        scope.formEvent = new Event(event);
        scope.eventForm = true;
      };


      scope.createEvent = function() {
        var error = function(response) {
          scope.showNotification("ライセンス数の上限に引っかかっています");
        };

        var success = function(event) {
          scope.myCalendar.fullCalendar("renderEvent", event,  true);
          scope.licenses.find(event).events.push(event);
        };

        scope.formEvent.create(success, error);
        scope.eventForm = false;
      };
    },
    templateUrl: 'event_form.html'
  };
});

var eventsService = angular.module('eventsService', ['ngResource']);
eventsService.factory('Events', function($resource) {
  return $resource('/projects/:project_id/schedulers/', {
    project_id: '@project_id',
    year: '@year',
    month: '@month',
    format: 'json'
  }, {
    query: {
      method: 'GET',
      isArray: true
    }
  });
});

var licenseParticipationService = angular.module('licenseParticipationService', ['ngResource']);
licenseParticipationService.factory("LicenseParticipation", function($resource) {
  return $resource('/projects/:project_id/schedulers/:schedule_id/participations', {
    project_id: '@project_id',
    schedule_id: '@schedule_id',
    format: 'json'
  });
});

calendarApp.value('modalOpts', {
  backdropFade: true,
  dialogFade:true,
  delete: false
});

calendarApp.value('eventHelper', {
  getEventId: function(eventId) {
    var eventIdArray = eventId.split('-');
    return eventIdArray[eventIdArray.length-1];
  }
});

calendarApp.directive("notificationModal", function() {
  return {
    restrict: 'A',
    link: function(scope, element, attr) {
      scope.notificationMessage = false;

      scope.closeNotification = function() {
        scope.notificationMessage = false;
      };

      scope.showNotification = function(message) {
        scope.notificationMessage = true;
        scope.notificationMessageContent = message;
      };

      scope.notificationClose = function() {
        scope.notificationMessage = false;
      };
    },
    templateUrl: 'notification.html'
  };
});


calendarApp.directive("licenseList", function(LicenseManager, LicenseParticipation) {
  return {
    restrict: 'A',
    link: function(scope, element, attr) {
      scope.hiddenLicense = function(element) {
        var hidden = function(events) {
          var removeIds = [];
          for(var i=0;i<events.length;i++)
            removeIds.push(events[i]._id);

          var filter = function(event) {
            for(var i=0; i<removeIds.length; i++) {
              if(removeIds[i] ===  event._id)
                return true;
            }
            return false;
          };
          scope.myCalendar.fullCalendar('removeEvents', filter);
        };

        var error = function(response) {
          console.log(response);
          scope.showNotification("リクエストが失敗しました");
        };

        element.license.save(hidden, error);
      };

      scope.showLicense = function(element) {
        var show = function(events) {
          scope.myCalendar.fullCalendar('addEventSource', events);
        };

        var error = function(response) {
          console.log(response);
          scope.showNotification("リクエストが失敗しました");
        };

        console.log(element);
        element.license.delete(show, error);
      };

      scope.switchLicense = function() {
        if (this.license.is_visible()) {
          scope.hiddenLicense(this);
        } else {
          scope.showLicense(this);
        }
      };

      scope.bgstyle = function(color) {
        return {backgroundColor: color};
      };
    },
    templateUrl: "license_list.html"
  };
});



calendarApp.controller('CalendarCtrl', function($scope, $dialog, $location, Event, Events, LicenseParticipation, LicenseManager, EventManager, modalOpts, eventHelper) {
  var date = new Date();
  var d = date.getDate();
  var m = date.getMonth();
  var y = date.getFullYear();
  var _split_url = location.href.split("/");
  // [TODO] Angularの$location.path()が空文字でかえってくる
  // 現在のURLからプロジェクトIDをとってくる
  $scope.project_id = _split_url[_split_url.length - 3];

  var current_date = new Date(y,m,1);

  $scope.licenses = LicenseManager;

  $scope.newReservation = false;
  $scope.updateEvent = false;
  $scope.eventSource = {
    className: "pochi-event"
  };
  // Global変数。初回読み込みサーバとはIDのみでやり取りする
  $scope.teams = $("#teams").data("articles");


  $scope.eventsF = function(start, end, callback) {
    var s = new Date(start).getTime() / 1000;
    var e = new Date(end).getTime() / 1000;
    var m = new Date(start).getMonth();
    var events = [
      {
        title: 'sample',
        allDay: true
      }
    ];
    callback(events);
  };

  $scope.eventSources = [$scope.licenses.visible_events, $scope.eventSource, $scope.eventsF];


  $scope.option_years = [];
  for(var i=y-5;i<=y+5;i++) {
    $scope.option_years.push(i);
  }

  $scope.option_months = [];
  for(var i=0;i<=12;i++) {
    $scope.option_months.push(i);
  }

  $scope.option_days = [];
  for(var i=0;i<=31;i++) {
    $scope.option_days.push(i);
  }

  $scope.alertOnDrop = function(event, day, minute, allDay, revert, js, ui, view) {
    $scope.$apply(function(){
      var currentEventId = event._id;

      var resource = new Event();
      resource.project_id = $scope.project_id;
      var eventIdArray = event._id.split("-");
      var scheduleIdArray = event.className[0].split("-");
      resource.event_id = eventIdArray[eventIdArray.length-1];
      resource.schedule_id = scheduleIdArray[scheduleIdArray.length-1];

      resource.start_date = event.start.getFullYear() + "-" + (event.start.getMonth() + 1) + "-" + event.start.getDate();
      if(event.end !== null) {
        resource.end_date = event.end.getFullYear() + "-" + (event.end.getMonth() + 1) + "-" + event.end.getDate();
      } else {
        resource.end_date  = resource.start_date;
      }
      resource.team = event.team;

      resource.$update(function(e,_) {
        var event = {title: e.event.content,
                     _id: 'event-' + e.event.id,
                     start: e.event.start_date,
                     end: e.event.end_date,
                     team: e.event.team_id,
                     backgroundColor: $scope.licenses[e.event.schedule_id].color,
                     className: 'custom-license-event-' + e.event.schedule_id,
                     borderColor: 'white'
                    };
        $scope.myCalendar.fullCalendar("removeEvents", currentEventId);
        $scope.myCalendar.fullCalendar("renderEvent", event,  true);
        var replaceEvents = [];
        var currentEvents = $scope.licenses[e.event.schedule_id].events;
        for(var i=0;i<currentEvents;i++) {
          if (currentEvents[i]._id !== currentEventId)
            replaceEvents.push(currentEvents[i]);
        }
        $scope.licenses[e.event.schedule_id].events = replaceEvents;
        $scope.licenses[e.event.schedule_id].events.push(event);
        $scope.newReservation = false;
      }, function error(response) {
        $scope.showNotification('ライセンス数の上限により、保存できませんでした');
        revert();
        console.log(response);
      });
    });
  };

  $scope.eventResize = function(event, day, minute, revert, js, ui, view) {
    $scope.$apply(function(){
      var currentEventId = event._id;

      var resource = new Event();
      resource.project_id = $scope.project_id;
      var eventIdArray = event._id.split("-");
      var scheduleIdArray = event.className[0].split("-");
      resource.event_id = eventIdArray[eventIdArray.length-1];
      resource.schedule_id = scheduleIdArray[scheduleIdArray.length-1];

      resource.start_date = event.start.getFullYear() + "-" + (event.start.getMonth() + 1) + "-" + event.start.getDate();
      if(event.end !== null) {
        resource.end_date = event.end.getFullYear() + "-" + (event.end.getMonth() + 1) + "-" + event.end.getDate();
      } else {
        resource.end_date  = resource.start_date;
      }

      resource.$update(function(e,_) {
        var event = {title: e.event.content,
                     _id: 'event-' + e.event.id,
                     start: e.event.start_date,
                     end: e.event.end_date,
                     backgroundColor: $scope.licenses[e.event.schedule_id].color,
                     className: 'custom-license-event-' + e.event.schedule_id,
                     borderColor: 'white'
                    };
        $scope.myCalendar.fullCalendar("removeEvents", currentEventId);
        $scope.myCalendar.fullCalendar("renderEvent", event,  true);
        var replaceEvents = [];
        var currentEvents = $scope.licenses[e.event.schedule_id].events;
        for(var i=0;i<currentEvents;i++) {
          if (currentEvents[i]._id !== currentEventId)
            replaceEvents.push(currentEvents[i]);
        }
        $scope.licenses[e.event.schedule_id].events = replaceEvents;
        $scope.licenses[e.event.schedule_id].events.push(event);
        $scope.newReservation = false;
      }, function error(response) {
        $scope.showNotification('ライセンス数の上限により、保存できませんでした');
        revert();
        console.log(response);
      });
    });
  };

  $scope.selectEvent = function(start, end, allDay) {
    $scope.$apply(function() {
      $scope.initializeDialog();
      $scope.setEventDateFromStartAndEnd(start, end);
      $scope.showEventForm(start, end);
      $scope.myCalendar.fullCalendar("unselect");
    });
  };

  $scope.editEvent = function(event) {
    $scope.$apply(function(){
      console.log(event);
      $scope.showEditEventForm(event);
    });
  };

  $scope.editEventBk = function(event) {
    $scope.$apply(function(){

      $scope.updateModalOpts();
      $scope.updateEvent(event);
      $scope.newReservation = true;
    });
  };


  // next button, prev button
  // Event manage
  $scope.viewDisplay = function(view) {
    var currentYear = view.start.getFullYear();
    var currentMonth = view.start.getMonth() + 1;

    EventManager.get({project_id: $scope.project_id, year: currentYear, month: currentMonth}, function(schedules, header) {
      angular.forEach(schedules, function(license, key) {
        $scope.licenses.push(license);
      });
    });
  };

  // http://iw3.me/156/
  $scope.uiConfig = {
    calendar:{
      height: 450,
      editable: true,
      dropable: true,
      header: {
        left: 'today prev, next, title',
        center :'',
        right: ''
      },
      select: $scope.selectEvent,
      eventDrop: $scope.alertOnDrop,
      eventResize: $scope.eventResize,
      eventClick: $scope.editEvent,
      viewDisplay: $scope.viewDisplay,
      weekends: true,
      firstDay: 1,
      selectable: true,
      selectHelper: true,
      // 月名称
      monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      // 月略称
      monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      // 曜日名称
      dayNames: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
      // 曜日略称
      dayNamesShort: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
      // ボタン文字列
      buttonText: {
          prev:     '&lsaquo;', // <
          next:     '&rsaquo;', // >
          prevYear: '&laquo;',  // <<
          nextYear: '&raquo;',  // >>
          today:    '今月',
          month:    '月',
          week:     '週',
          day:      '日'
      },
      // タイトルの書式
      titleFormat: {
          month: 'yyyy年M月',                             // 2013年9月
          week: "yyyy年M月d日{ ～ }{[yyyy年]}{[M月]d日}",  // 2013年9月7日 ～ 13日
          day: "yyyy年M月d日'('ddd')'"                    // 2013年9月7日(火)
      }
    }
  };

  // 以下のメソッドは全てモデルに移行予定
  $scope.modalOpts = modalOpts;

  $scope.initializeDialog = function() {
    $scope.modalOpts.title = '新規予約';
    $scope.modalOpts.submitText = '作成';
    $scope.modalOpts.delete = false;
    $scope.title = null;
    $scope.license = null;
    $scope.eventId = null;
    $scope.startYear = null;
    $scope.startMonth = null;
    $scope.startDate = null;
    $scope.endYear = null;
    $scope.endMonth = null;
    $scope.endDate = null;
  };

  $scope.deleteEvent = function() {
    var resource = $scope.replaceEventModelFrom(this);
    resource.$delete(function(e, _){
      $scope.afterDelete(e);
    }, function error(response) {
        console.log(response);
    });
  };


  $scope.updateModalOpts = function() {
    $scope.modalOpts.title = '更新';
    $scope.modalOpts.submitText = '更新';
    $scope.modalOpts.delete = true;
  };

  $scope.updateEvent = function(event) {
    $scope.eventId = eventHelper.getEventId(event._id);
    $scope.setEventDate(event);
    $scope.title = event.title;
    $scope.team = event.team;
    console.log(event);

    var customEventArray = event.className[0].split('-');
    $scope.license = customEventArray[customEventArray.length-1];
  };

  $scope.setEventDate = function(event) {
    if(event.end === null)
      event.end = event.start;
    $scope.setEventDateFromStartAndEnd(event.start, event.end);
  };

  $scope.setEventDateFromStartAndEnd = function(start, end) {
    $scope.startYear = start.getFullYear();
    $scope.startMonth = start.getMonth() + 1;
    $scope.startDate = start.getDate();
    $scope.endYear = end.getFullYear();
    $scope.endMonth = end.getMonth() + 1;
    $scope.endDate = end.getDate();
  };


  $scope.afterDelete = function(e) {
    var replaceEvents = [];
    var currentEvents = $scope.licenses[e.event.schedule_id].events;
    for(var i=0;i<currentEvents;i++) {
      if (currentEvents[i]._id !== 'event-' + e.event.id)
        replaceEvents.push(currentEvents[i]);
    }
    $scope.myCalendar.fullCalendar("removeEvents", 'event-' + e.event.id);
    $scope.licenses[e.event.schedule_id].events = replaceEvents;
    $scope.licenses[e.event.schedule_id].events.push(e.event);
    $scope.dialogClose();
    $scope.showNotification('予定を削除しました');
  };

  $scope.afterUpdate = function(e, beforeEventId) {
    var event = {title: e.event.content,
                 _id: 'event-' + e.event.id,
                 start: e.event.start_date,
                 end: e.event.end_date,
                 backgroundColor: $scope.licenses[e.event.schedule_id].color,
                 className: 'custom-license-event-' + e.event.schedule_id,
                 borderColor: 'white'
                };
    $scope.myCalendar.fullCalendar("removeEvents", 'event-' + beforeEventId);
    $scope.myCalendar.fullCalendar("renderEvent", event,  true);
    var replaceEvents = [];
    var currentEvents = $scope.licenses[e.event.schedule_id].events;
    for(var i=0;i<currentEvents;i++) {
      if (currentEvents[i]._id !== 'event-' + beforeEventId)
        replaceEvents.push(currentEvents[i]);
    }
    $scope.licenses[e.event.schedule_id].events = replaceEvents;
    $scope.licenses[e.event.schedule_id].events.push(event);
    $scope.newReservation = false;
  };

  $scope.dateIsNotFilled = function(event) {
    if(!event.endDate)
      return true;
    if(!event.endMonth)
      return true;
    if(!event.endYear)
      return true;
    if(!event.startDate)
      return true;
    if(!event.startMonth)
      return true;
    if(!event.startYear)
      return true;

    return false;
  };

});

// ng-model以外のイベントはこっちでやる。
$(function(){
  $("td.fc-day").hover(function() {
    $(this).addClass("fc-state-highlight");
  }, function(){
    $(this).removeClass("fc-state-highlight");
  });
});
