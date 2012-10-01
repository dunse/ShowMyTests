
//endsWith credit: http://stackoverflow.com/users/3055/chakrit
if (!String.prototype.endsWith) {
	String.prototype.endsWith = function(suffix) {
		return this.indexOf(suffix, this.length - suffix.length) !== -1;
	};
}

$.views.helpers({
	getTestSummaryClass: function(testSummary) {
		if (testSummary.failed > 0) {
			return "Fail";
		} else if (testSummary.skipped > 0) {
			return "Skip";
		} else {
			return "Pass";
		}
	}
});

$(window).resize(function() {
	capp.resizePopup();
});

var capp = {
		projectData: {},

		config: {
			history: "/cuanto/project/history",
			outcomes: "/cuanto/api/getTestOutcomes",
			getTestOutput: function(id) {
				return "/cuanto/api/getTestOutput/" + id;
			}
		},

		getProjectData: function(projectKey, callback) {
			var self = this;
			self.initErrorHandler();
			$.when(self.getLastRun(projectKey)).done(function(runData) {
				var testRun = runData.testRuns[0];
				$.when(self.getTestOutcomes(testRun.id)).done(function(outcomes) {
					callback(self.getFormatProjectData(testRun, outcomes.testOutcomes));
				});
			});
		},

		showTestOutput: function(obj) {
			var self = this;
			outcomeId = $(obj).attr("data-outcome-id");
			if (outcomeId) {
				capp.getTestOutput(outcomeId, function(output) {
					$("pre#popupText").append(document.createTextNode(output));
					self.showPopup();
				});
			}
		},

		showTestToggle: function(obj) {
			if ($(obj).attr('data-mode') == "plus") {
				$(obj).empty().append('&ndash;');
				$(obj).attr('data-mode', 'minus');
				$(obj).closest('#testSystem').find('.Pass').show();
			} else {
				$(obj).empty().append('+');
				$(obj).attr('data-mode', 'plus');
				$(obj).closest('#testSystem').find('.Pass').hide();
			}
			console.log("clicked" + $(obj));
		},

		getLastRun: function(projectKey) {
			return $.ajax(this.config.history, {
				timeout: 3000,
				dataType: "json",
				data: {
					projectKey: projectKey,
					max: 1,
					order: "desc",
					sort: "dateExecuted",
					format: "json"
				}
			});
		},

		getTestOutcomes: function(runId) {
			return $.ajax(this.config.outcomes, {
				timeout: 5000,
				dataType: "json",
				data: {
					id: runId,
					sort: "fullName",
					order: "asc",
					max: 100,
					offset: 0
				}
			});
		},

		// Generic Error handler
		initErrorHandler: function() {
			$("div#errorcontainer").ajaxError(
					function(e, x, settings, exception) {
						var message;
						var statusErrorMap = {
								'400' : "Server understood the request but request content was invalid.",
								'401' : "Unauthorised access.",
								'403' : "Forbidden resouce can't be accessed",
								'404' : "Page not found",
								'500' : "Internal Server Error.",
								'503' : "Service Unavailable"
						};
						if (x.status) {
							message =statusErrorMap[x.status];
							if(!message){
								message="Unknow Error \n.";
							}
						} else if(e=='parsererror'){
							message="Error.\nParsing JSON Request failed.";
						}else if(e=='timeout'){
							message="Request Time out.";
						}else if(e=='abort'){
							message="Request was aborted by the server";
						}else { 
							message="Unknow Error \n.";
						}
						$(this).css("display","inline");
						$(this).html("ERROR: " + message);
					});
		},

		getFormatProjectData: function(testRun, outcomes) {
			return {
				name: testRun.projectName,
				dateExecuted: testRun.dateExecuted,
				dateCreated: testRun.dateCreated,
				testSummary: {
					tests: testRun.tests,
					passed: testRun.passed,
					failed: testRun.failed,
					skipped: testRun.skipped,
					totalDuration: testRun.totalDuration
				},
				layers: this.getSortedTestResults(outcomes)
			};
		},

		getSortedTestResults: function(outcomes) {
			var self = this;
			var testResults = {
					"Frontend": {},
					"Service": {},
					"Backend": {}
			};
			$.each(outcomes, function() {
				var packageName = this.testCase.packageName;
				var layerName = self.getLayerName(packageName);
				console.log(layerName + " - " + packageName);
				if (!testResults[layerName][packageName]) {
					testResults[layerName][packageName] = [];
				}
				testResults[layerName][packageName].push({
					id: this.id,
					result: this.result,
					duration: this.duration,
					testName: this.testCase.testName,
					packageName: this.testCase.packageName,
					fullName: this.testCase.fullName,
					parameters: this.testCase.parameters,
					dateCreated: this.dateCreated,
					lastUpdated: this.lastUpdated,
					testOutput: this.testOutput
				});
			});
			console.log(testResults);
			return [{
				name: "Frontends",
				containers: self.getContainers(testResults["Frontend"])
			},
			{
				name: "Service",
				containers: self.getContainers(testResults["Service"])
			},
			{
				name: "Backends",
				containers: self.getContainers(testResults["Backend"])
			}];
		},

		getContainers: function(container) {
			var self = this;
			var newContainer = [];
			$.each(container, function(key, value) {
				newContainer.push({
					name: key,
					tests: value,
					testSummary: self.getLayerTestSummary(value)
				});
			});
			return newContainer;
		},

		getLayerName: function(packageName) {
			if (packageName.endsWith("Frontend")) {
				return "Frontend";
			} else if (packageName.endsWith("Service")) {
				return "Service";
			} else if (packageName.endsWith("Backend")) {
				return "Backend";
			}
		},

		getLayerTestSummary: function(results) {
			var testSummary = {
					tests: 0,
					passed: 0,
					failed: 0,
					skipped: 0,
					totalDuration: 0
			};
			if (results) {
				testSummary["tests"] = results.length;
				$.each(results, function() {
					if (this.result == "Pass") {
						testSummary["passed"]++;
					} else if(this.result == "Fail") {
						testSummary["failed"]++;
					} else if(this.result == "Skip") {
						testSummary["skipped"]++;
					}
					testSummary["totalDuration"]+= this.duration;
				});
			}
			return testSummary;
		},

		getTestOutput: function (testId, callback) {
			var self = this;
			self.initErrorHandler();

			$.when(this.getTestOutputCall(testId)).done(function(output) {
				callback(output);
			});

		},

		getTestOutputCall: function(id) {
			// Get all test runs for all environments
			return $.ajax(self.config.getTestOutput(id), {
				timeout: 3000,
				dataType: "text"
			});
		},

		showPopup: function() {
			var self = this;
			self.resizePopup();
			$("#screenOverlay").show();
			$("#popup").show();
		},
		hidePopup: function() {
			$("#screenOverlay").hide();
			$("#popup").hide();
			$("pre#popupText").empty();
		},

		resizePopup: function() {
			var winw = $(window).width();
			var winh = $(window).height();
			$("#screenOverlay").height = winh;
			$("#popup").css({
				width: winw - 100,
				left: 50,
				top: 50
			});
			$("#popup").height(winh - 100);
			$("#popupText").height(winh - 150);
		}

};